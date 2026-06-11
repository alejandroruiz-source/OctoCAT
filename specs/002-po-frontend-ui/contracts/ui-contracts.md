# UI Contracts: Purchase Order Management Frontend

**Branch**: `002-po-frontend-ui` | **Date**: 2026-06-10

These contracts define the prop interfaces and observable behavior of the major UI components. Contract tests in `web/tests/contract/` are written against these contracts — they must fail before components are implemented.

---

## API Client Contracts

### `web/src/api/purchaseOrders.ts`

```typescript
// List POs — role-scoped by auth token
list(params: {
  status?: PurchaseOrderStatus[]
  supplierId?: string
  page?: number
  limit?: number
}): Promise<PurchaseOrderListResponse>

// Get full PO detail with line items and history
getById(poId: string): Promise<PODetailViewModel>

// Create a new draft PO
create(input: {
  supplierId: string
  branchId: string
  expectedDeliveryDate?: string   // ISO date
  notes?: string | null
}): Promise<PurchaseOrderResponse>

// Update PO metadata (notes, expected delivery date)
update(poId: string, input: {
  expectedDeliveryDate?: string
  notes?: string | null
}): Promise<PurchaseOrderResponse>

// Submit PO — transitions DRAFT → SUBMITTED or AWAITING_APPROVAL
submit(poId: string, expectedDeliveryDate?: string): Promise<PurchaseOrderResponse>

// Cancel PO — transitions any non-terminal status → CANCELLED
cancel(poId: string): Promise<PurchaseOrderResponse>

// Fulfill PO — transitions SUBMITTED|APPROVED → FULFILLED (SUPPLIER only)
fulfill(poId: string): Promise<PurchaseOrderResponse>

// Acquire edit lock — 409 if already locked
acquireLock(poId: string): Promise<LockResponse>

// Release edit lock
releaseLock(poId: string): Promise<void>

// Get status history for a PO
getHistory(poId: string): Promise<StatusHistoryEntry[]>
```

---

### `web/src/api/lineItems.ts`

```typescript
add(poId: string, item: {
  productId: string
  productName: string
  quantity: number       // positive integer
  unitPriceCents: number // positive integer
}): Promise<LineItemResponse>

update(poId: string, lineItemId: string, input: {
  quantity?: number
  unitPriceCents?: number
}): Promise<LineItemResponse>

remove(poId: string, lineItemId: string): Promise<void>
```

---

### `web/src/api/approvals.ts`

```typescript
approve(poId: string): Promise<ApprovalResponse>

reject(poId: string, reason: string): Promise<ApprovalResponse>
// reason must be non-empty string — UI enforces this before calling
```

---

## Component Contracts

### `POStatusBadge`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `PurchaseOrderStatus` | yes | Current PO status |
| `size` | `'sm' \| 'md'` | no (default: `'md'`) | Badge size |

**Observable behavior**:
- Renders a colored badge label matching the Status→Display Mapping in `data-model.md`
- Each status value renders a distinct color (never two statuses share the same color)
- `AWAITING_APPROVAL` status renders with amber styling

---

### `LockWarning`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `lockedBy` | `string` | yes | User ID holding the lock |
| `lockExpiresAt` | `Date` | yes | When the lock expires |

**Observable behavior**:
- Displays lock holder identity
- Shows time remaining until lock expiry (e.g., "Expires in 24 minutes")
- When `lockExpiresAt` is in the past, shows "Lock expired"
- Does not render an edit button or form — purely informational

---

### `LineItemRow`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `item` | `LineItemResponse` | yes | Line item data |
| `editable` | `boolean` | yes | Whether edit/delete controls are shown |
| `onEdit` | `(item: LineItemResponse) => void` | no | Callback when edit is clicked |
| `onDelete` | `(lineItemId: string) => void` | no | Callback when delete is clicked |

**Observable behavior**:
- When `editable=false`, no edit or delete controls are rendered
- When `editable=true`, edit and delete buttons are present
- Extended price displayed as `quantity × unitPrice` in currency format
- Extended price updates immediately when `item.extendedPriceCents` changes

---

### `LineItemEditor`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `initial` | `LineItemDraft \| null` | no | Pre-populated values for edit mode |
| `onSave` | `(draft: LineItemDraft) => void` | yes | Called with validated draft on submit |
| `onCancel` | `() => void` | yes | Called when user cancels |
| `isLoading` | `boolean` | no | Shows loading state on save button |

**Observable behavior**:
- `quantity` must be a positive integer; form blocks save if < 1
- `unitPriceCents` must be a positive integer; form blocks save if ≤ 0
- Extended price preview updates in real time as quantity or unit price changes
- Save is blocked (button disabled) while `isLoading=true`

---

### `StatusHistory`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `entries` | `StatusHistoryEntry[]` | yes | History entries, oldest first |

**Observable behavior**:
- Entries rendered in chronological order (index 0 = oldest)
- Each entry shows: from-status (or "—" for initial), arrow, to-status, actor ID, date/time
- When `note` is non-null, it is displayed beneath the transition (e.g., rejection reason)
- When `entries` is empty, renders a placeholder message ("No status history yet")

---

### `POListPage` (buyer view)

**Observable behavior** (tested against MSW handlers):
- Shows "No purchase orders found" when API returns empty `items` array
- Shows PO rows with status badge, PO number, total, supplier name, updated date
- Status filter controls visible; changing filter re-queries the API
- Pagination controls visible when `total > limit`; clicking page 2 queries `?page=2`
- "New Purchase Order" button present and navigates to `/buyer/po/new`
- API error (500) shows an error banner — not a blank screen

---

### `PODetailPage` (buyer view — draft/revision)

**Observable behavior** (tested against MSW handlers):
- For DRAFT or REVISION_REQUIRED status: edit controls and "Add Line Item" button visible
- For all other statuses: all fields read-only, no edit controls
- Line items list renders each `LineItemRow` with editable matching PO editability
- Running total updates when a line item mutation succeeds (TanStack Query cache invalidation)
- Lock warning (`LockWarning`) rendered when `isLocked=true`
- REVISION_REQUIRED: rejection reason displayed above the line items
- "Cancel PO" button present for DRAFT; shows confirmation modal before calling cancel API
- "Submit" button present for DRAFT and REVISION_REQUIRED

---

### `POSubmitPage`

**Observable behavior** (tested against MSW handlers):
- Delivery date field required; submit button disabled if date is empty or invalid
- When `totalCents >= APPROVAL_THRESHOLD_CENTS`: approval threshold notice visible before submit button
- When `totalCents < APPROVAL_THRESHOLD_CENTS`: no notice shown
- On successful submit: navigates to PO detail page showing updated status

---

### `ApprovalQueuePage`

**Observable behavior** (tested against MSW handlers):
- Shows only POs with `status === 'AWAITING_APPROVAL'`
- Overdue POs (approvalDeadline < now) rendered with distinct visual treatment
- "No POs awaiting approval" placeholder when queue is empty
- Clicking a row navigates to `ApprovalDetailPage`

---

### `ApprovalDetailPage`

**Observable behavior** (tested against MSW handlers):
- "Approve" button calls `approvals.approve(poId)` on click after confirmation
- "Reject" button opens a text input for the rejection reason
- Reject submit is disabled when the reason field is empty
- After approve/reject: PO removed from queue and user navigates back to queue

---

### `SupplierPOListPage`

**Observable behavior** (tested against MSW handlers):
- Shows only non-DRAFT POs for the supplier's account
- No buyer POs from other suppliers visible
- "Fulfill" action button only visible on SUBMITTED or APPROVED POs
- Clicking fulfill shows confirmation modal, then calls `fulfill(poId)`

---

## Error Handling Contracts

All page-level components must handle these API error scenarios:

| Scenario | Expected UI behavior |
|----------|----------------------|
| Network error / timeout | Error banner with retry button |
| 401 Unauthorized | Redirect to IdP login |
| 403 Forbidden | "You don't have permission" message |
| 404 Not Found | "Purchase order not found" message |
| 409 Conflict (lock) | `LockWarning` component with lock details |
| 409 Conflict (invalid transition) | Toast or inline message with the error text |
| 422 Unprocessable | Field-level validation messages |
| 500 Internal Error | Generic error banner, do not expose raw error |
