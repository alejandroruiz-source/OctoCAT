# Quickstart: Purchase Order Management Frontend

**Branch**: `002-po-frontend-ui` | **Date**: 2026-06-10

This guide walks through setting up, running, and validating the frontend SPA. The frontend lives in `web/` and communicates with the backend API from spec 001 (`src/`).

---

## Prerequisites

- Node.js 20 LTS or newer (same as backend)
- Backend API running: `npm run dev` from repo root (starts Fastify on `http://localhost:3000`)
- For integration tests only: no extra setup — the Playwright config starts a test backend automatically

---

## Setup

```bash
# From repo root
cd web
npm install
```

---

## Development

```bash
# Start backend (repo root, in one terminal)
npm run dev

# Start frontend dev server (web/, in another terminal)
npm run dev
# → http://localhost:5173
```

On first load without a real IdP configured, the app redirects to the OIDC provider URL. For local development, set `VITE_AUTH_DISABLED=true` in `web/.env.local` to skip OIDC and use the test user configured in `web/src/auth/AuthProvider.tsx`.

---

## Validation Scenarios

The following scenarios prove the feature works end-to-end. Each maps to a success criterion from the spec.

---

### Scenario 1: Buyer Creates and Submits a Low-Value PO (SC-001)

**Role**: BUYER | **Expected duration**: < 5 minutes

1. Open `http://localhost:5173` — confirm PO list page loads (SC-003: < 2 seconds).
2. Click "New Purchase Order."
3. Select any supplier and branch from the dropdowns. Click Create.
4. On the PO detail page, click "Add Line Item."
5. Enter: Product Name = `Widgets`, Quantity = `5`, Unit Price = `$50.00`. Confirm extended price shows `$250.00`.
6. Add a second line item: Product Name = `Bolts`, Quantity = `100`, Unit Price = `$0.50`. Confirm total shows `$300.00`.
7. Click Submit. Enter delivery date = 30 days from today. Confirm **no** approval threshold notice (total is under $10,000).
8. Click Confirm Submit.
9. **Expected**: PO status updates to `Submitted`. All fields are read-only. No edit or add-line-item controls visible.

---

### Scenario 2: Buyer Submits a High-Value PO — Routes to Approval (SC-001, FR-006)

**Role**: BUYER

1. Create a new PO and add a line item: Quantity = `1`, Unit Price = `$15,000.00`.
2. Click Submit.
3. **Expected**: Approval threshold notice visible — "This PO requires manager approval" (or similar).
4. Enter delivery date, click Confirm Submit.
5. **Expected**: PO status updates to `Awaiting Approval`.

---

### Scenario 3: Approver Reviews Queue and Approves (SC-002)

**Role**: APPROVER | **Expected duration**: < 2 minutes

1. Switch to APPROVER role (or open a new browser session with approver credentials).
2. Open the Approval Queue page.
3. **Expected**: PO from Scenario 2 appears in the queue.
4. Click the PO row to open the detail.
5. Confirm: full PO details visible including total, buyer info, approval deadline.
6. Click Approve, confirm the prompt.
7. **Expected**: PO disappears from the queue. Status is `Approved`.

---

### Scenario 4: Approver Rejects with Reason — Buyer Revises (FR-008, FR-009)

**Role**: APPROVER then BUYER

1. As APPROVER: open a PO in AWAITING_APPROVAL, click Reject.
2. **Expected**: Reason field appears. Submit is disabled with empty reason.
3. Enter reason: "Budget not authorized for Q2." Click Reject.
4. **Expected**: PO status changes to `Revision Required`.
5. Switch to BUYER role. Open the same PO.
6. **Expected**: Rejection reason prominently displayed. Edit controls available (editable state).
7. Edit a line item to reduce the total below $10,000.
8. Click Submit (no approval threshold notice expected).
9. **Expected**: PO re-enters `Submitted` status.

---

### Scenario 5: Supplier Views and Fulfills a PO (US-5)

**Role**: SUPPLIER

1. Open the supplier PO list.
2. **Expected**: Only non-Draft POs addressed to this supplier are visible. No other buyers' POs shown.
3. Click a PO in `Submitted` or `Approved` status.
4. **Expected**: "Fulfill" button visible. No "Fulfill" button on POs in other statuses.
5. Click Fulfill, confirm the prompt.
6. **Expected**: PO status changes to `Fulfilled`.

---

### Scenario 6: Status History Timeline (US-6)

**Role**: Any

1. Open any PO that has gone through at least 3 status transitions.
2. Scroll to the Status History section.
3. **Expected**:
   - Entries in chronological order (oldest at top)
   - Each entry shows: from-status, to-status, actor, timestamp
   - Rejection reason visible on the `REVISION_REQUIRED` transition entry
4. Confirm entry count matches expected transitions.

---

### Scenario 7: Lock Conflict (FR-012)

**Role**: BUYER (two sessions)

1. Open a DRAFT PO in Session A (buyer). Click "Edit" or "Add Line Item" — lock is acquired.
2. Open the same PO in Session B (different buyer or same buyer, different tab).
3. **Expected**: Lock warning displayed in Session B showing the lock holder identity and time remaining until expiry.
4. No edit controls available in Session B while the lock is active.

---

### Scenario 8: Status Polling (SC-006)

1. Open a PO detail page in one browser tab.
2. In a second tab (or via `curl`), submit the PO via the API.
3. Wait up to 15 seconds without refreshing the first tab.
4. **Expected**: The status badge in the first tab updates to the new status automatically.

---

## Running Tests

### Component Contract Tests (Vitest + RTL + MSW)

```bash
cd web
npm test
# or for watch mode:
npm run test:watch
```

All contract tests must pass. They run against MSW handlers — no backend required.

### Integration Tests (Playwright)

```bash
cd web
npm run test:e2e
```

Playwright automatically starts a Fastify backend on a random port with an in-memory SQLite database and test-auth mode. Scenarios run in Chromium headlessly. Use `--headed` to watch:

```bash
npm run test:e2e -- --headed
```

### Full Test Suite

```bash
# From repo root
npm test          # backend Vitest tests
cd web && npm test  # frontend Vitest tests
cd web && npm run test:e2e  # Playwright integration
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | Backend API base URL |
| `VITE_OIDC_AUTHORITY` | *(required in production)* | OIDC provider URL |
| `VITE_OIDC_CLIENT_ID` | *(required in production)* | OIDC client ID |
| `VITE_AUTH_DISABLED` | `false` | Skip OIDC, use test user (dev only) |
| `VITE_TEST_USER_ROLE` | `BUYER` | Role for test user when auth disabled |

Set these in `web/.env.local` for local development (gitignored).
