# Data Model: Purchase Order Management System

**Branch**: `001-purchase-order-mgmt` | **Date**: 2026-06-10

---

## Overview

Five tables are owned by this feature: `purchase_orders`, `line_items`, `approvals`, `po_status_history`, and `notifications`. Four external entities are referenced but not managed: `users`, `branches`, `suppliers`, and `products` (from existing systems).

All money values are stored as **integer cents** (e.g., $10,000.00 = `1000000`). All timestamps are **Unix milliseconds** stored as integers. All primary keys are **UUIDs** (text).

---

## Owned Entities

### purchase_orders

The central entity. Tracks the full lifecycle of a PO from draft to terminal state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | UUID v4 |
| `po_number` | text | NOT NULL, UNIQUE | Human-readable: `PO-YYYY-NNNNNN` (e.g., `PO-2026-000001`) |
| `status` | text | NOT NULL, DEFAULT `DRAFT` | See Status Enum below |
| `buyer_id` | text | NOT NULL | FK → users.id (existing system) |
| `branch_id` | text | NOT NULL | FK → branches.id (existing system) |
| `supplier_id` | text | NOT NULL | FK → suppliers.id (existing system) |
| `expected_delivery_date` | text | NULL | ISO date string (YYYY-MM-DD); required before submission |
| `total_cents` | integer | NOT NULL, DEFAULT 0, ≥ 0 | Sum of all `line_items.extended_price_cents`; recalculated on every line item change |
| `notes` | text | NULL | Optional buyer notes; max 1000 chars |
| `locked_by` | text | NULL | userId holding the edit lock; NULL = unlocked |
| `locked_at` | integer | NULL | Unix ms when lock was acquired; expires after 30 minutes |
| `created_at` | integer | NOT NULL | Unix ms |
| `updated_at` | integer | NOT NULL | Unix ms; updated on every mutation |
| `submitted_at` | integer | NULL | Unix ms; set on first submission and on resubmission |
| `approved_at` | integer | NULL | Unix ms; set when approver approves |
| `fulfilled_at` | integer | NULL | Unix ms; set when supplier marks fulfilled |

**Status Enum**:

| Value | Terminal? | Description |
|-------|-----------|-------------|
| `DRAFT` | No | PO is being built by buyer |
| `SUBMITTED` | No | Submitted; no approval required (total < $10,000) |
| `AWAITING_APPROVAL` | No | Submitted; pending approver decision (total ≥ $10,000) |
| `APPROVED` | No | Approver approved the PO |
| `FULFILLED` | Yes | Supplier confirmed delivery |
| `CANCELLED` | Yes | Buyer cancelled (from DRAFT or REVISION_REQUIRED only) |
| `REVISION_REQUIRED` | No | Approver rejected; buyer must revise and resubmit |

**Validation rules**:
- `total_cents` must equal `SUM(line_items.extended_price_cents)` for the PO at all times
- `locked_at` older than 30 minutes is treated as expired (lock is auto-released on next access)
- `po_number` is generated at INSERT time from a zero-padded auto-incrementing integer sequence

---

### line_items

One row per product line within a PO. Cannot exist without a parent PO.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | UUID v4 |
| `purchase_order_id` | text | NOT NULL, FK → purchase_orders.id ON DELETE CASCADE | Parent PO |
| `line_number` | integer | NOT NULL | 1-based ordinal within the PO; UNIQUE per PO |
| `product_id` | text | NOT NULL | FK → products.id (existing system; snapshot used) |
| `product_name` | text | NOT NULL | Snapshot of product name at line item creation; max 255 chars |
| `quantity` | integer | NOT NULL, > 0 | Units ordered |
| `unit_price_cents` | integer | NOT NULL, > 0 | Price per unit in USD cents |
| `extended_price_cents` | integer | NOT NULL, > 0 | `quantity × unit_price_cents`; computed and stored |

**UNIQUE constraint**: `(purchase_order_id, line_number)`

**Validation rules**:
- `quantity` must be ≥ 1; zero and negative values are rejected
- `unit_price_cents` must be ≥ 1
- `extended_price_cents` is always computed — never accepted from client input
- Line items may only be added/edited/deleted when PO status is `DRAFT` or `REVISION_REQUIRED`
- At least one line item must exist before a PO can be submitted

---

### approvals

Records each approver decision. A PO can have multiple approval records if it cycles through REVISION_REQUIRED and back.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | UUID v4 |
| `purchase_order_id` | text | NOT NULL, FK → purchase_orders.id | Parent PO |
| `approver_id` | text | NOT NULL | FK → users.id (must have `APPROVER` role) |
| `decision` | text | NOT NULL, CHECK IN (`APPROVED`, `REJECTED`) | Approver's decision |
| `reason` | text | NULL for APPROVED, NOT NULL for REJECTED | Rejection reason; required when `decision = REJECTED`; max 1000 chars |
| `decided_at` | integer | NOT NULL | Unix ms |

**Validation rules**:
- `reason` is required when `decision = REJECTED`; optional (nullable) when `decision = APPROVED`
- Only users with `role = APPROVER` may insert approval records
- Approval only valid when PO is in `AWAITING_APPROVAL` status

---

### po_status_history

Immutable audit log of every PO status transition. Never updated or deleted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | UUID v4 |
| `purchase_order_id` | text | NOT NULL, FK → purchase_orders.id | Parent PO |
| `from_status` | text | NULL | Previous status; NULL on initial DRAFT creation |
| `to_status` | text | NOT NULL | New status after transition |
| `changed_by_id` | text | NOT NULL | FK → users.id; actor who triggered the transition |
| `changed_at` | integer | NOT NULL | Unix ms |
| `note` | text | NULL | Optional context (e.g., rejection reason summary) |

**Validation rules**:
- A row is inserted for every status transition, including the initial DRAFT creation
- Rows are never updated or deleted (compliance requirement FR-020)

---

### notifications

Outbox table for durable async notification delivery. Owned by the notification outbox worker.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | UUID v4 |
| `purchase_order_id` | text | NOT NULL, FK → purchase_orders.id | Source PO |
| `recipient_type` | text | NOT NULL, CHECK IN (`SUPPLIER`, `APPROVER`, `BUYER`) | Audience category |
| `recipient_id` | text | NOT NULL | FK → users.id or suppliers.id depending on `recipient_type` |
| `event_type` | text | NOT NULL, CHECK IN (`PO_SUBMITTED`, `PO_APPROVED`, `PO_REJECTED`, `PO_ON_HOLD`, `APPROVAL_REQUESTED`) | Notification trigger |
| `payload` | text | NOT NULL | JSON blob with PO details for notification content |
| `status` | text | NOT NULL, DEFAULT `PENDING`, CHECK IN (`PENDING`, `SENT`, `FAILED`) | Delivery status |
| `retry_count` | integer | NOT NULL, DEFAULT 0, ≥ 0 | Delivery attempts made |
| `created_at` | integer | NOT NULL | Unix ms |
| `sent_at` | integer | NULL | Unix ms when successfully delivered |
| `last_attempt_at` | integer | NULL | Unix ms of most recent attempt (success or failure) |

**Outbox worker behaviour**:
- Polls every 5 seconds for rows where `status = PENDING` OR (`status = FAILED` AND `retry_count < 5`)
- On success: `status → SENT`, `sent_at = now()`
- On failure: `retry_count++`, `last_attempt_at = now()`, exponential backoff; after 5 failures `status → FAILED` (permanent)

---

## External Reference Entities

These entities exist in upstream systems and are referenced by FK. This feature reads from them but does not own or migrate them.

| Entity | Referenced columns | Where used |
|--------|-------------------|------------|
| `users` | `id`, `role` (BUYER / APPROVER / SUPPLIER) | buyer_id, approver_id, changed_by_id, locked_by |
| `branches` | `id`, `name` | branch_id on purchase_orders |
| `suppliers` | `id`, `name`, `notification_email` | supplier_id on purchase_orders; recipient_id in notifications |
| `products` | `id`, `name`, `current_price_cents` | product_id on line_items; `product_name` snapshot stored at creation |

---

## State Machine

```
                     ┌─────────────────────────────────────────────────────┐
                     │                                                     │
         [create]    ▼          [submit, total < $10k]                    │
  ──────► DRAFT ────────────────────────────────────► SUBMITTED ──┐       │
             │                                                     │       │
             │  [submit, total ≥ $10k]                            │       │
             ├──────────────────────► AWAITING_APPROVAL ──┐       │       │
             │                              │              │       │       │
             │                  [reject]    │  [approve]   │       │       │
             │                             ▼              ▼       │       │
             │                    REVISION_REQUIRED    APPROVED   │       │
             │                          │    │              │      │       │
             │          [cancel]        │    │ [resubmit]   │      │       │
             │◄─────────────────────────┘    │              │      │       │
             │                               └──────────────┘      │       │
             │  [cancel]                      (loops back to        │       │
             ▼                                AWAITING_APPROVAL)    │       │
          CANCELLED ◄─────────────────────────────────────────────-┘       │
             ▲                                                              │
             │  (formerly: approver rejection went here; now REVISION_REQ) │
             └──────────────────────────────────────────────────────────────┘

          FULFILLED ◄──── SUBMITTED (fulfill) or APPROVED (fulfill)
```

**Valid transitions table**:

| From | To | Trigger | Actor |
|------|----|---------|-------|
| — | `DRAFT` | Create PO | BUYER |
| `DRAFT` | `SUBMITTED` | Submit (total < $10,000) | BUYER |
| `DRAFT` | `AWAITING_APPROVAL` | Submit (total ≥ $10,000) | BUYER |
| `DRAFT` | `CANCELLED` | Cancel | BUYER |
| `SUBMITTED` | `FULFILLED` | Mark fulfilled | SUPPLIER |
| `AWAITING_APPROVAL` | `APPROVED` | Approve | APPROVER |
| `AWAITING_APPROVAL` | `REVISION_REQUIRED` | Reject with reason | APPROVER |
| `APPROVED` | `FULFILLED` | Mark fulfilled | SUPPLIER |
| `REVISION_REQUIRED` | `AWAITING_APPROVAL` | Revise and resubmit | BUYER |
| `REVISION_REQUIRED` | `CANCELLED` | Cancel (abandon revision) | BUYER |

All other transitions are invalid and must return HTTP 409 `INVALID_STATUS_TRANSITION`.

---

## Relationships Diagram

```
users (external)
  │
  ├─── buyer_id ──────────────────► purchase_orders ──── branch_id ──► branches (external)
  ├─── approver_id ─────────────►  │    │                └─ supplier_id ──► suppliers (external)
  ├─── changed_by_id ─────────────►│    │
  └─── locked_by ──────────────────┘    │
                                        │
                                        ├──────────────────► line_items
                                        │                      └─ product_id ──► products (external)
                                        ├──────────────────► approvals
                                        ├──────────────────► po_status_history
                                        └──────────────────► notifications
```

---

## Key Integrity Rules

1. **PO total integrity**: `purchase_orders.total_cents` must always equal `SUM(line_items.extended_price_cents)`. Recomputed atomically on every line item insert/update/delete within a transaction.
2. **Submission gate**: A PO with zero line items cannot be submitted (HTTP 422 `INSUFFICIENT_LINE_ITEMS`).
3. **Delivery date gate**: `expected_delivery_date` must be set and be a future date before a PO can be submitted.
4. **Edit gate**: Line items and PO metadata are only mutable in `DRAFT` or `REVISION_REQUIRED` status.
5. **Approval gate**: Approval actions are only valid when PO is in `AWAITING_APPROVAL`.
6. **Fulfillment gate**: Fulfillment is only valid when PO is in `SUBMITTED` or `APPROVED`.
7. **Lock expiry**: `locked_by` is treated as NULL if `locked_at < now() - 30 minutes`.
8. **Audit trail**: Every status transition inserts a `po_status_history` row; these rows are never deleted.
9. **Soft delete**: Cancelled/Fulfilled POs are never hard-deleted; `status` marks them as terminal.
