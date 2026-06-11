# Quickstart & Validation Guide: Purchase Order Management System

**Branch**: `001-purchase-order-mgmt` | **Date**: 2026-06-10

This guide covers setup, running the test suites, and three end-to-end validation scenarios
that prove the PO lifecycle works correctly. It references [contracts/openapi.yaml](./contracts/openapi.yaml)
and [data-model.md](./data-model.md) for schema details.

---

## Prerequisites

- Node.js 20 LTS (`node --version` → `v20.x.x`)
- npm 10+ (`npm --version`)
- `node-gyp` build tools (required for `better-sqlite3` native addon)
  - Windows: `npm install --global windows-build-tools` or Visual Studio Build Tools
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `apt-get install build-essential python3`

---

## Setup

```bash
# Install dependencies
npm install

# Generate the initial SQLite migration from the Drizzle schema
npx drizzle-kit generate:sqlite --schema=src/lib/db/schema.ts --out=drizzle/

# (Optional) Verify the migration file was created
ls drizzle/
# Expected: 0000_initial_schema.sql  meta/

# Start the API server (development)
npm run dev
# Server starts at http://localhost:3000
# OpenAPI docs at http://localhost:3000/docs
```

---

## Running Tests

Tests must be run in this order per the TDD mandate: contract tests first (must fail red initially),
then integration tests, then unit tests.

```bash
# 1. Contract tests (validate HTTP response shapes against OpenAPI schemas)
npm run test:contract
# All tests should FAIL before implementation — this is expected and required (TDD red phase)

# 2. Integration tests (real SQLite :memory: databases, no mocks)
npm run test:integration

# 3. Unit tests (pure business logic)
npm run test:unit

# All suites together with coverage
npm run test

# Coverage report
npm run test:coverage
```

**Expected `package.json` scripts**:
```json
{
  "scripts": {
    "dev": "tsx watch src/api/server.ts",
    "test": "vitest run",
    "test:contract": "vitest run tests/contract/",
    "test:integration": "vitest run tests/integration/",
    "test:unit": "vitest run tests/unit/",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Validation Scenarios

These scenarios prove the three primary PO lifecycle paths work end-to-end.
Run against a running dev server (`npm run dev`) or via `fastify.inject()` in tests.

All requests require a Bearer JWT. For local testing, use a pre-signed test token that
encodes the appropriate `userId` and `role` claims.

### Scenario 1: Low-Value PO — Full Lifecycle (DRAFT → SUBMITTED → FULFILLED)

Validates: US-1 (create/manage draft), US-2 (submit + notify), US-4 (fulfillment tracking)

```bash
# Step 1: Create a draft PO (as BUYER)
POST /api/v1/purchase-orders
Authorization: Bearer <buyer-token>
{
  "supplierId": "<supplier-uuid>",
  "branchId": "<branch-uuid>"
}
# Expected: 201, status="DRAFT", totalCents=0, poNumber="PO-2026-000001"

# Step 2: Acquire edit lock
POST /api/v1/purchase-orders/<poId>/lock
Authorization: Bearer <buyer-token>
# Expected: 200, lockedBy=<buyerId>, expiresAt=<now+30min>

# Step 3: Add line item (quantity=10, unitPrice=$50.00 = 5000 cents)
POST /api/v1/purchase-orders/<poId>/line-items
Authorization: Bearer <buyer-token>
{
  "productId": "<product-uuid>",
  "productName": "Widget A",
  "quantity": 10,
  "unitPriceCents": 5000
}
# Expected: 201, extendedPriceCents=50000, lineNumber=1

# Step 4: Verify PO total updated
GET /api/v1/purchase-orders/<poId>
# Expected: 200, totalCents=50000 ($500.00 — under $10k threshold, no approval required)

# Step 5: Submit PO (total < $10,000 → SUBMITTED, no approval)
POST /api/v1/purchase-orders/<poId>/submit
Authorization: Bearer <buyer-token>
{
  "expectedDeliveryDate": "2026-08-01"
}
# Expected: 200, status="SUBMITTED", submittedAt=<timestamp>
# Side effect: PENDING notification queued for supplier

# Step 6: Verify supplier cannot edit submitted PO
PATCH /api/v1/purchase-orders/<poId>
Authorization: Bearer <buyer-token>
{ "notes": "trying to edit" }
# Expected: 409 INVALID_STATUS_TRANSITION

# Step 7: Supplier marks as fulfilled
POST /api/v1/purchase-orders/<poId>/fulfill
Authorization: Bearer <supplier-token>
# Expected: 200, status="FULFILLED", fulfilledAt=<timestamp>

# Step 8: Verify status history
GET /api/v1/purchase-orders/<poId>/history
# Expected: 200, array with entries:
#   null → DRAFT (create)
#   DRAFT → SUBMITTED (submit)
#   SUBMITTED → FULFILLED (fulfill)
```

**Pass criteria**: All 8 steps return expected status codes and body shapes.
`notifications` table contains a PENDING or SENT row for the supplier.

---

### Scenario 2: High-Value PO — Approval Path (DRAFT → AWAITING_APPROVAL → APPROVED → FULFILLED)

Validates: US-3 (approval workflow), SC-003 (routing by threshold), SC-005 (approval deadline)

```bash
# Steps 1–3: Same as Scenario 1 but with high-value line item
# Add line item: quantity=100, unitPriceCents=150000 ($1,500.00 each = $150,000 total)
POST /api/v1/purchase-orders/<poId>/line-items
{
  "productId": "<product-uuid>",
  "productName": "Industrial Compressor",
  "quantity": 100,
  "unitPriceCents": 150000
}
# Expected: extendedPriceCents=15000000, PO totalCents=15000000 ($150,000 — above threshold)

# Submit (total ≥ $10,000 → AWAITING_APPROVAL)
POST /api/v1/purchase-orders/<poId>/submit
{ "expectedDeliveryDate": "2026-09-01" }
# Expected: 200, status="AWAITING_APPROVAL"
# Expected: approvalDeadline field present (submittedAt + 24 business hours)
# Side effect: PENDING notification queued for all APPROVER-role users

# Approver views pending PO
GET /api/v1/purchase-orders/<poId>
Authorization: Bearer <approver-token>
# Expected: 200, full PO detail with line items visible

# Approver approves
POST /api/v1/purchase-orders/<poId>/approve
Authorization: Bearer <approver-token>
# Expected: 200, decision="APPROVED", status transitions to APPROVED
# Side effect: PENDING notification queued for supplier

# Supplier fulfills
POST /api/v1/purchase-orders/<poId>/fulfill
Authorization: Bearer <supplier-token>
# Expected: 200, status="FULFILLED"

# Verify buyer cannot approve (role check)
POST /api/v1/purchase-orders/<poId>/approve
Authorization: Bearer <buyer-token>
# Expected: 403 FORBIDDEN
```

**Pass criteria**: PO correctly routes to `AWAITING_APPROVAL` for totals ≥ $10,000.
`approvalDeadline` is present and equals `submittedAt + 24 business hours`.
Non-approver role receives 403 on approve endpoint.

---

### Scenario 3: Rejection and Resubmission (AWAITING_APPROVAL → REVISION_REQUIRED → AWAITING_APPROVAL)

Validates: Updated US-3 scenarios 5–6, FR-015, FR-015a, state machine Revision Required path

```bash
# Create, add high-value line item, submit (same as Scenario 2 steps 1–4)
# PO is now in AWAITING_APPROVAL

# Approver rejects with reason
POST /api/v1/purchase-orders/<poId>/reject
Authorization: Bearer <approver-token>
{
  "reason": "Unit price exceeds approved vendor rate. Please revise to $1,200/unit."
}
# Expected: 200, decision="REJECTED"
# Expected: PO status transitions to REVISION_REQUIRED
# Side effect: PENDING notification for buyer (with rejection reason)
# Side effect: PENDING notification for supplier (PO_ON_HOLD)

# Verify rejection without reason is rejected
POST /api/v1/purchase-orders/<poId>/reject
Authorization: Bearer <approver-token>
{}
# Expected: 400 VALIDATION_ERROR

# Buyer views revision notice
GET /api/v1/purchase-orders/<poId>
Authorization: Bearer <buyer-token>
# Expected: 200, status="REVISION_REQUIRED"

# Buyer acquires lock and revises line item price
POST /api/v1/purchase-orders/<poId>/lock
Authorization: Bearer <buyer-token>

PATCH /api/v1/purchase-orders/<poId>/line-items/<lineItemId>
Authorization: Bearer <buyer-token>
{ "unitPriceCents": 120000 }
# Expected: 200, extendedPriceCents=12000000, PO totalCents recalculated

# Buyer resubmits (REVISION_REQUIRED → AWAITING_APPROVAL)
POST /api/v1/purchase-orders/<poId>/submit
Authorization: Bearer <buyer-token>
{ "expectedDeliveryDate": "2026-09-15" }
# Expected: 200, status="AWAITING_APPROVAL" (always re-enters approval for resubmissions)
# Side effect: New PENDING notification for approvers

# Approver now approves the revised PO
POST /api/v1/purchase-orders/<poId>/approve
Authorization: Bearer <approver-token>
# Expected: 200, status=APPROVED

# Verify status history shows full cycle
GET /api/v1/purchase-orders/<poId>/history
# Expected: entries in order:
#   null → DRAFT
#   DRAFT → AWAITING_APPROVAL
#   AWAITING_APPROVAL → REVISION_REQUIRED
#   REVISION_REQUIRED → AWAITING_APPROVAL
#   AWAITING_APPROVAL → APPROVED
```

**Pass criteria**: Complete rejection→revision→resubmission cycle completes without errors.
Status history accurately reflects all transitions. Two approval records exist in `approvals` table
for this PO (one REJECTED, one APPROVED).

---

## Key Invariants to Assert in Tests

These invariants must hold after every mutating operation:

1. `purchase_orders.total_cents = SUM(line_items.extended_price_cents WHERE purchase_order_id = po.id)`
2. `line_items.extended_price_cents = quantity × unit_price_cents` (always server-computed)
3. Every status transition has a corresponding `po_status_history` row
4. POs in FULFILLED or CANCELLED status have no mutation operations succeed (all return 409)
5. A submitted PO with `total_cents < 1000000` has status `SUBMITTED` (not `AWAITING_APPROVAL`)
6. A submitted PO with `total_cents >= 1000000` has status `AWAITING_APPROVAL`
7. `notifications` table contains a row for each expected event (PO_SUBMITTED, APPROVAL_REQUESTED, etc.)
8. Resubmission from `REVISION_REQUIRED` always routes to `AWAITING_APPROVAL` regardless of total
