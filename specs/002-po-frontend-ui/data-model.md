# Data Model: Purchase Order Management Frontend

**Branch**: `002-po-frontend-ui` | **Date**: 2026-06-10

This document describes the frontend view models and state shapes used in the SPA. The frontend has no persistence layer — all shapes derive from the backend REST API responses defined in `specs/001-purchase-order-mgmt/contracts/openapi.yaml` and the TypeBox schemas in `src/lib/models/`.

---

## Shared Backend Types (imported, not redefined)

The following types are imported directly from the backend via the `~backend/` path alias:

| Backend module | Exported type | Used in frontend for |
|----------------|--------------|----------------------|
| `~backend/purchaseOrder` | `PurchaseOrderResponse` | PO list items, PO detail base |
| `~backend/purchaseOrder` | `PurchaseOrderStatus` | Status badge coloring, edit-mode guards |
| `~backend/purchaseOrder` | `PurchaseOrderListResponse` | Paginated list from `GET /purchase-orders` |
| `~backend/purchaseOrder` | `StatusHistoryEntry` | History timeline rendering |
| `~backend/purchaseOrder` | `LockResponse` | Lock warning display |
| `~backend/lineItem` | `LineItemResponse` | Line item row rendering |
| `~backend/approval` | `ApprovalResponse` | Post-approve/reject confirmation |

---

## Frontend-Only View Models

These types are constructed in the frontend and never sent to the API.

### `SessionUser`

Represents the authenticated user extracted from the OIDC ID token.

```typescript
interface SessionUser {
  userId: string        // sub claim from ID token
  role: 'BUYER' | 'SUPPLIER' | 'APPROVER'  // custom claim
  displayName: string   // name or preferred_username claim
  email: string
}
```

**Source**: OIDC ID token claims. Role is a custom claim set by the IdP at login.

---

### `PODetailViewModel`

Extends the API `PurchaseOrderResponse` with eagerly loaded nested data for the detail page.

```typescript
interface PODetailViewModel extends PurchaseOrderResponse {
  lineItems: LineItemResponse[]
  statusHistory: StatusHistoryEntry[]
  isEditable: boolean     // computed: status === 'DRAFT' || 'REVISION_REQUIRED'
  isLocked: boolean       // computed: lockedBy !== null && lockNotExpired
  lockExpiresAt: Date | null  // computed: lockedAt + 30 minutes
  totalDisplay: string    // computed: centsToDisplay(totalCents)
  rejectionReason: string | null  // extracted from last statusHistory entry where toStatus === 'REVISION_REQUIRED'
}
```

**Source**: `GET /api/v1/purchase-orders/:poId` response (includes `lineItems` and `statusHistory`).

---

### `POSummaryViewModel`

Condensed shape used in list pages.

```typescript
interface POSummaryViewModel {
  id: string
  poNumber: string
  status: PurchaseOrderStatus
  statusDisplay: string     // human-readable label
  statusColor: 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple'
  totalDisplay: string      // e.g. "$1,234.56"
  supplierName: string      // resolved from supplierId (see SupplierRef)
  updatedAt: string
  approvalDeadline: string | null
  isOverdue: boolean        // approvalDeadline !== null && past now
}
```

**Source**: `GET /api/v1/purchase-orders` items, enriched client-side with computed fields.

---

### `LineItemDraft`

Client-side mutable state for an in-progress line item add/edit.

```typescript
interface LineItemDraft {
  productId: string
  productName: string
  quantity: number
  unitPriceCents: number
  extendedPriceCents: number   // computed: quantity * unitPriceCents
}
```

**Source**: Local form state only; submitted to `POST /api/v1/purchase-orders/:poId/line-items`.

---

### `ApprovalQueueItem`

Approval queue view model for the `ApprovalQueuePage`.

```typescript
interface ApprovalQueueItem extends PurchaseOrderResponse {
  buyerDisplayName: string    // resolved from buyerId
  approvalDeadline: string    // non-null for AWAITING_APPROVAL
  isOverdue: boolean          // approvalDeadline < now
  overdueByDisplay: string | null  // e.g. "2 hours overdue"
  totalDisplay: string
}
```

**Source**: `GET /api/v1/purchase-orders?status=AWAITING_APPROVAL` (approver-scoped).

---

### `ApiError`

Normalized error shape from the API client for consistent UI error handling.

```typescript
interface ApiError {
  status: number
  code: string      // e.g. 'NOT_FOUND', 'CONFLICT', 'UNPROCESSABLE'
  message: string
}
```

**Source**: Normalized in `web/src/api/client.ts` from all non-2xx responses.

---

## Status → Display Mapping

| Status | Label | Color |
|--------|-------|-------|
| `DRAFT` | Draft | gray |
| `SUBMITTED` | Submitted | blue |
| `AWAITING_APPROVAL` | Awaiting Approval | amber |
| `APPROVED` | Approved | green |
| `REVISION_REQUIRED` | Revision Required | red |
| `FULFILLED` | Fulfilled | purple |
| `CANCELLED` | Cancelled | gray (muted) |

**Used by**: `POStatusBadge`, `POSummaryViewModel.statusColor`

---

## Edit-Mode Guard

```typescript
const EDITABLE_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'REVISION_REQUIRED']

function isEditable(status: PurchaseOrderStatus): boolean {
  return EDITABLE_STATUSES.includes(status)
}
```

**Used by**: `PODetailViewModel.isEditable`, `LineItemRow`, `PODetailPage`

---

## Lock Expiry

Lock duration is 30 minutes (backend constant). The frontend computes `lockExpiresAt` from `lockedAt + 30 min` and displays a countdown. A lock is considered active when `lockedBy !== null` AND `new Date() < lockExpiresAt`.

---

## Approval Threshold

```typescript
const APPROVAL_THRESHOLD_CENTS = 1_000_000  // $10,000.00

function requiresApproval(totalCents: number): boolean {
  return totalCents >= APPROVAL_THRESHOLD_CENTS
}
```

**Used by**: `POSubmitPage` to display the approval threshold warning (FR-006).

---

## TanStack Query Key Conventions

| Query key | Data | Refetch interval |
|-----------|------|-----------------|
| `['purchase-orders', filters]` | Paginated PO list | 10s for AWAITING_APPROVAL filter, 30s otherwise |
| `['purchase-orders', poId]` | Single PO detail | 10s (SC-006) |
| `['purchase-orders', poId, 'history']` | Status history | On-demand |

Cache is invalidated after any mutation (create, update, submit, cancel, fulfill, approve, reject) via `queryClient.invalidateQueries`.
