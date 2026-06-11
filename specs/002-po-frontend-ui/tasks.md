# Tasks: Purchase Order Management Frontend

**Input**: Design documents from `specs/002-po-frontend-ui/`

**Prerequisites**: plan.md âœ“, spec.md âœ“, research.md âœ“, data-model.md âœ“, contracts/ui-contracts.md âœ“, quickstart.md âœ“

**Tests**: Included per constitution mandate (TDD â€” Non-Negotiable). Contract tests (RTL + MSW) must be written first and must fail before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Paths use `web/` for frontend, `src/` for existing backend (no backend changes)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the `web/` project with all tooling configured before any feature work begins.

- [x] T001 Create `web/` directory structure per plan.md: `src/api/`, `src/auth/`, `src/components/ui/`, `src/components/po/`, `src/pages/buyer/`, `src/pages/approver/`, `src/pages/supplier/`, `src/hooks/`, `src/lib/`, `tests/contract/`, `tests/integration/`
- [x] T002 Create `web/package.json` with all dependencies from plan.md: react 19, react-dom, react-router-dom 7, @tanstack/react-query 5, oidc-client-ts 3, tailwindcss 4, @vitejs/plugin-react 4, vite 6, vitest 2, @testing-library/react 16, @testing-library/user-event 14, @testing-library/jest-dom, jsdom, msw 2, @playwright/test 1, typescript 5
- [x] T003 [P] Create `web/vite.config.ts` with React plugin, path alias `~backend` â†’ `../src/lib/models`, and Vitest config (environment: jsdom, globals: true, setupFiles: `./tests/setup.ts`)
- [x] T004 [P] Create `web/tsconfig.json` with strict TypeScript settings and path alias `~backend/*` â†’ `../src/lib/models/*`
- [x] T005 [P] Create `web/tailwind.config.js` with content paths covering `./src/**/*.{ts,tsx}`
- [x] T006 [P] Create `web/index.html` with root div and script tag loading `src/main.tsx`
- [x] T007 [P] Initialize MSW v2: run `msw init web/public/` to generate `mockServiceWorker.js`, create `web/tests/setup.ts` with server `beforeAll`/`afterEach`/`afterAll` lifecycle and `@testing-library/jest-dom` import
- [x] T008 Create `web/playwright.config.ts`: Chromium only, baseURL `http://localhost:5173`, `webServer` config that starts both backend (`npm run dev` at root) and frontend (`npm run dev` in `web/`)
- [x] T009 [P] Create `web/.env.local.example` with `VITE_API_BASE_URL=http://localhost:3000/api/v1`, `VITE_OIDC_AUTHORITY=`, `VITE_OIDC_CLIENT_ID=`, `VITE_AUTH_DISABLED=false`, `VITE_TEST_USER_ROLE=BUYER`
- [x] T010 [P] Add root `package.json` convenience scripts: `"web:dev": "cd web && npm run dev"`, `"web:test": "cd web && npm test"`, `"web:build": "cd web && npm run build"`, `"web:e2e": "cd web && npm run test:e2e"`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by all user stories. Must be complete before any user story phase begins.

**âš ï¸ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T011 Create `web/src/api/client.ts`: base `apiFetch<T>` function that attaches `Authorization: Bearer <token>` header (or `x-test-user-id` / `x-test-user-role` headers when `VITE_AUTH_DISABLED=true`), normalizes non-2xx responses to `ApiError { status, code, message }`, and returns typed `Promise<T>`
- [x] T012 [P] Create `web/src/auth/AuthProvider.tsx` and `web/src/auth/useAuth.ts`: OIDC `UserManager` with PKCE flow; on load check session â€” redirect to IdP if unauthenticated; expose `{ user: SessionUser | null, token: string | null, logout, isLoading }` via React context; when `VITE_AUTH_DISABLED=true` return a synthetic `SessionUser` with role from `VITE_TEST_USER_ROLE`
- [x] T013 [P] Create `web/src/lib/formatters.ts`: `centsToDisplay(cents: number): string` (Intl.NumberFormat USD), `formatDate(iso: string): string` (locale date), `relativeTime(date: Date): string` (e.g., "2 hours ago"), `lockExpiresAt(lockedAt: string): Date` (lockedAt + 30 minutes)
- [x] T014 [P] Create `web/src/lib/constants.ts`: `APPROVAL_THRESHOLD_CENTS = 1_000_000`, `LOCK_DURATION_MS = 30 * 60 * 1000`, `STATUS_LABELS` map, `STATUS_COLORS` map (as defined in data-model.md status display mapping)
- [x] T015 [P] Create `web/src/components/ui/Button.tsx`: variants `primary | secondary | danger`, sizes `sm | md`, `isLoading` prop disables and shows spinner
- [x] T016 [P] Create `web/src/components/ui/Badge.tsx`: `color` prop accepts the color values from `STATUS_COLORS` (gray/blue/amber/green/red/purple), `size` sm/md
- [x] T017 [P] Create `web/src/components/ui/Table.tsx`: generic typed table with `columns` + `data` props, `emptyMessage` prop, and optional pagination controls (`page`, `totalPages`, `onPageChange`)
- [x] T018 [P] Create `web/src/components/ui/Modal.tsx`: accessible modal with `title`, `children`, `onClose`, `isOpen` props; renders confirm/cancel footer buttons via `actions` prop
- [x] T019 [P] Create `web/src/components/ui/ErrorBanner.tsx`: displays `ApiError` or generic error message with optional Retry button and `onRetry` callback
- [x] T020 Create `web/src/main.tsx`: wrap app with `QueryClientProvider` (staleTime: 0), `AuthProvider`, `RouterProvider` from `web/src/router.tsx`
- [x] T021 Create `web/src/router.tsx` as a placeholder with a single `/` catch-all route (will be populated per user story phase); role-based navigation shell (render buyer/approver/supplier nav items based on `SessionUser.role`)

**Checkpoint**: Foundation ready â€” all user story phases can now begin.

---

## Phase 3: User Story 1 â€” Buyer: Create and Manage Draft POs (Priority: P1) ðŸŽ¯ MVP

**Goal**: A buyer can view their PO list, create a new draft PO, add/edit/delete line items with a live running total, and cancel the PO.

**Independent Test**: A buyer can create a new PO with two line items, edit a quantity, delete one item, verify the total recalculates, and cancel the PO â€” no approver or supplier involvement required.

### Tests for US1 (TDD â€” write first, must fail before T028+)

- [x] T022 [US1] Write contract test for `POListPage` in `web/tests/contract/POListPage.contract.test.tsx`: (1) renders "No purchase orders" when API returns empty items; (2) renders PO rows with status badge, poNumber, total, updatedAt; (3) status filter change triggers re-query; (4) "New Purchase Order" button present; (5) API 500 renders ErrorBanner; (6) pagination controls shown when total > limit
- [x] T023 [P] [US1] Write contract test for `PODetailPage` (draft mode) in `web/tests/contract/PODetailPage.contract.test.tsx`: (1) edit controls and "Add Line Item" visible for DRAFT status; (2) edit controls hidden for SUBMITTED status; (3) LineItemRow renders with editable=true for DRAFT; (4) LockWarning renders when PO is locked; (5) Cancel PO button opens confirmation modal; (6) total updates when line item mutation resolves
- [x] T024 [P] [US1] Write Playwright integration test for buyer draft flow in `web/tests/integration/buyer.flow.test.ts`: start as BUYER â†’ create PO â†’ add 2 line items â†’ verify running total â†’ edit quantity on line item 1 â†’ verify total updates â†’ delete line item 2 â†’ verify total recalculates â†’ cancel PO â†’ verify status is Cancelled

### Implementation for US1

- [x] T025 [P] [US1] Implement PO API client functions in `web/src/api/purchaseOrders.ts`: `list`, `getById`, `create`, `update`, `cancel`, `acquireLock`, `releaseLock`, `getHistory` â€” typed against shared `~backend/purchaseOrder` types
- [x] T026 [P] [US1] Implement line item API client functions in `web/src/api/lineItems.ts`: `add`, `update`, `remove` â€” typed against shared `~backend/lineItem` types
- [x] T027 [US1] Implement `web/src/api/types.ts`: re-export `PurchaseOrderResponse`, `PurchaseOrderStatus`, `PurchaseOrderListResponse`, `StatusHistoryEntry`, `LockResponse` from `~backend/purchaseOrder`; `LineItemResponse` from `~backend/lineItem`; `ApprovalResponse` from `~backend/approval`
- [x] T028 [US1] Implement `usePurchaseOrders` hooks in `web/src/hooks/usePurchaseOrders.ts`: `usePoList(params)` query (30s refetchInterval), `usePoDetail(poId)` query (10s refetchInterval per SC-006), `useCreatePo` mutation (invalidates list), `useUpdatePo` mutation, `useCancelPo` mutation (invalidates list + detail), `useLockPo` mutation, `useReleaseLock` mutation
- [x] T029 [US1] Implement `useLineItems` hooks in `web/src/hooks/useLineItems.ts`: `useAddLineItem(poId)` mutation (invalidates `['purchase-orders', poId]`), `useUpdateLineItem(poId)` mutation, `useRemoveLineItem(poId)` mutation â€” all invalidate PO detail to refresh running total
- [x] T030 [P] [US1] Implement `POStatusBadge` component in `web/src/components/po/POStatusBadge.tsx`: maps `PurchaseOrderStatus` â†’ `STATUS_LABELS` + `STATUS_COLORS`; renders `Badge` component; sizes sm/md
- [x] T031 [P] [US1] Implement `LockWarning` component in `web/src/components/po/LockWarning.tsx`: displays lock holder `lockedBy`, computes expiry from `lockExpiresAt()`, shows countdown string; renders "Lock expired" when past expiry
- [x] T032 [US1] Implement `LineItemRow` component in `web/src/components/po/LineItemRow.tsx`: displays productName, quantity, unitPrice (formatted), extendedPrice (formatted); shows edit and delete `Button` controls when `editable=true`; calls `onEdit`/`onDelete` callbacks
- [x] T033 [US1] Implement `LineItemEditor` component in `web/src/components/po/LineItemEditor.tsx`: form with productName, quantity (positive integer), unitPriceCents (positive integer, input in dollars converts to cents); live extended price preview; Save disabled when invalid or `isLoading`; Cancel button calls `onCancel`
- [x] T034 [US1] Implement `POListPage` in `web/src/pages/buyer/POListPage.tsx`: `usePoList` query with status filter state; `Table` with POStatusBadge per row; pagination controls; "New Purchase Order" button navigates to `/buyer/po/new`; `ErrorBanner` on error; "No purchase orders found" empty state
- [x] T035 [US1] Implement `POCreatePage` in `web/src/pages/buyer/POCreatePage.tsx`: form with supplierId and branchId inputs; `useCreatePo` mutation on submit; on success navigate to `/buyer/po/:poId`; on error show `ErrorBanner`
- [x] T036 [US1] Implement `PODetailPage` (base) in `web/src/pages/buyer/PODetailPage.tsx`: `usePoDetail(poId)` query (10s interval); `LockWarning` when `isLocked`; `LineItemRow` list with editable based on `isEditable`; `LineItemEditor` add form when editable; `POStatusBadge`; Cancel PO `Modal` confirmation using `useCancelPo`; running total display
- [x] T037 [US1] Add buyer base routes to `web/src/router.tsx`: `/buyer/po` â†’ `POListPage`, `/buyer/po/new` â†’ `POCreatePage`, `/buyer/po/:poId` â†’ `PODetailPage`

**Checkpoint**: Buyer can create, manage, and cancel draft POs. Test with `npm test` (contract) and Playwright buyer draft scenario from quickstart.md.

---

## Phase 4: User Story 2 â€” Buyer: Submit a Purchase Order (Priority: P1)

**Goal**: A buyer can submit a draft PO, providing a delivery date; the interface shows an approval threshold warning for POs â‰¥$10,000; submitted PO becomes read-only.

**Independent Test**: Submit a low-value PO (â†’ Submitted, no notice) and a high-value PO (â†’ approval notice â†’ Awaiting Approval).

### Tests for US2 (TDD â€” write first, must fail before T041+)

- [x] T038 [US2] Write contract test for `POSubmitPage` in `web/tests/contract/POSubmitPage.contract.test.tsx`: (1) delivery date field required â€” submit blocked when empty; (2) approval threshold notice rendered when `totalCents >= 1_000_000`; (3) no approval notice when `totalCents < 1_000_000`; (4) on successful submit API call, page shows read-only PO detail
- [x] T039 [P] [US2] Write Playwright submit flow test in `web/tests/integration/buyer.flow.test.ts` (append): submit PO under $10k â†’ status becomes Submitted â†’ fields read-only; submit PO at $10k â†’ notice shown â†’ status becomes Awaiting Approval â†’ fields read-only

### Implementation for US2

- [x] T040 [US2] Add `useSubmitPo` mutation to `web/src/hooks/usePurchaseOrders.ts`: calls `purchaseOrders.submit(poId, expectedDeliveryDate?)`; on success invalidates `['purchase-orders', poId]` and navigates to detail page
- [x] T041 [US2] Implement `POSubmitPage` in `web/src/pages/buyer/POSubmitPage.tsx`: delivery date `<input type="date">` (required); reads `totalCents` from cached PO detail; renders approval threshold notice `Banner` when `requiresApproval(totalCents)`; Confirm Submit calls `useSubmitPo`; Cancel returns to detail page
- [x] T042 [US2] Add Submit route and link to `web/src/router.tsx`: `/buyer/po/:poId/submit` â†’ `POSubmitPage`; add "Submit" button to `PODetailPage` (visible only when status is DRAFT or REVISION_REQUIRED)

**Checkpoint**: Full buyer createâ†’add itemsâ†’submit flow works end-to-end. Validates quickstart.md Scenarios 1 and 2.

---

## Phase 5: User Story 3 â€” Approver: Review and Decide on High-Value POs (Priority: P2)

**Goal**: An approver sees all POs in Awaiting Approval status, can approve (â†’ Approved) or reject with a required reason (â†’ Revision Required). Overdue POs are visually distinguished.

**Independent Test**: Approver approves one PO and rejects another with a reason â€” without buyer or supplier interaction.

### Tests for US3 (TDD â€” write first, must fail before T049+)

- [ ] T043 [US3] Write contract test for `ApprovalQueuePage` in `web/tests/contract/ApprovalQueuePage.contract.test.tsx`: (1) renders only AWAITING_APPROVAL POs; (2) overdue POs (approvalDeadline in past) have visual distinction; (3) "No POs awaiting approval" when queue is empty; (4) clicking a row navigates to detail
- [ ] T044 [P] [US3] Write contract test for `ApprovalDetailPage` in `web/tests/contract/ApprovalDetailPage.contract.test.tsx`: (1) Approve and Reject buttons present; (2) Reject opens reason input; (3) Reject submit disabled when reason is empty; (4) Approve shows confirmation before calling API
- [ ] T045 [P] [US3] Write Playwright approver flow test in `web/tests/integration/approver.flow.test.ts`: as APPROVER â†’ open queue â†’ PO from buyer submit visible â†’ approve first PO â†’ disappears from queue, status Approved; reject second PO with reason â†’ disappears from queue, status Revision Required

### Implementation for US3

- [ ] T046 [P] [US3] Implement approval API client functions in `web/src/api/approvals.ts`: `approve(poId): Promise<ApprovalResponse>`, `reject(poId, reason: string): Promise<ApprovalResponse>` â€” typed against `~backend/approval`
- [ ] T047 [US3] Implement `useApprovals` hooks in `web/src/hooks/useApprovals.ts`: `useApprovalQueue()` query with `refetchInterval: 10_000` and status=AWAITING_APPROVAL filter; `useApprovePo` mutation (invalidates queue + detail); `useRejectPo` mutation (invalidates queue + detail)
- [ ] T048 [P] [US3] Implement `ApprovalQueuePage` in `web/src/pages/approver/ApprovalQueuePage.tsx`: `useApprovalQueue` query; `Table` with `POStatusBadge`, buyer info, total, approvalDeadline; overdue rows get amber background or "Overdue" label; empty state; row click navigates to detail
- [ ] T049 [US3] Implement `ApprovalDetailPage` in `web/src/pages/approver/ApprovalDetailPage.tsx`: full PO detail (read-only); approval deadline display; Approve button â†’ `Modal` confirmation â†’ `useApprovePo`; Reject button â†’ inline reason `<textarea>` (required, min 1 char) â†’ `useRejectPo`; on success navigate back to queue
- [ ] T050 [US3] Add approver routes to `web/src/router.tsx`: `/approver/queue` â†’ `ApprovalQueuePage`, `/approver/queue/:poId` â†’ `ApprovalDetailPage`

**Checkpoint**: Approver can approve and reject POs independently. Validates quickstart.md Scenarios 3 and 4 (first half).

---

## Phase 6: User Story 4 â€” Buyer: Revise and Resubmit a Rejected PO (Priority: P2)

**Goal**: A buyer sees the rejection reason prominently on a REVISION_REQUIRED PO, can edit line items just like a draft, and resubmit to re-enter the approval queue.

**Independent Test**: Open a REVISION_REQUIRED PO, read rejection reason, edit a line item, resubmit â€” status returns to Awaiting Approval.

### Tests for US4 (TDD â€” write first, must fail before T055+)

- [ ] T051 [US4] Write Playwright revision flow test in `web/tests/integration/buyer.flow.test.ts` (append): as BUYER â†’ open REVISION_REQUIRED PO â†’ rejection reason displayed prominently â†’ edit line item to change total â†’ resubmit â†’ status is Awaiting Approval

### Implementation for US4

- [ ] T052 [US4] Update `PODetailPage` in `web/src/pages/buyer/PODetailPage.tsx`: when `status === 'REVISION_REQUIRED'` and `rejectionReason` is non-null, render a prominent rejection reason banner above the line items
- [ ] T053 [US4] Verify `isEditable` guard in `PODetailPage` correctly enables edit controls for `REVISION_REQUIRED` status (same path as DRAFT â€” confirm no code change needed or fix if missing)
- [ ] T054 [US4] Verify `POSubmitPage` handles submission from REVISION_REQUIRED state correctly (same submit API call â€” confirm the page renders and submit works when navigated from a REVISION_REQUIRED PO)

**Checkpoint**: Full revision loop works â€” reject â†’ revise â†’ resubmit. Validates quickstart.md Scenario 4 (full).

---

## Phase 7: User Story 5 â€” Supplier: View and Fulfill (Priority: P3)

**Goal**: A supplier sees only non-Draft POs addressed to their account and can mark a SUBMITTED or APPROVED PO as Fulfilled.

**Independent Test**: Supplier views two POs, fulfills one SUBMITTED PO â€” status changes to Fulfilled; Fulfill button absent on Fulfilled and Cancelled POs.

### Tests for US5 (TDD â€” write first, must fail before T059+)

- [ ] T055 [US5] Write contract test for `SupplierPOListPage` in `web/tests/contract/SupplierPOListPage.contract.test.tsx`: (1) only non-DRAFT POs shown; (2) Fulfill button visible only on SUBMITTED or APPROVED rows; (3) Fulfill button absent on FULFILLED/CANCELLED rows
- [ ] T056 [P] [US5] Write Playwright supplier flow test in `web/tests/integration/supplier.flow.test.ts`: as SUPPLIER â†’ view PO list (only own non-draft POs) â†’ open SUBMITTED PO â†’ click Fulfill â†’ confirm modal â†’ status changes to Fulfilled

### Implementation for US5

- [ ] T057 [US5] Add `useFulfillPo` mutation to `web/src/hooks/usePurchaseOrders.ts`: calls `purchaseOrders.fulfill(poId)`; on success invalidates list and detail
- [ ] T058 [P] [US5] Implement `SupplierPOListPage` in `web/src/pages/supplier/SupplierPOListPage.tsx`: `usePoList` query (supplier role auto-filters non-Draft POs via backend); `Table` with `POStatusBadge`, poNumber, total, supplierId; Fulfill `Button` visible only when `status === 'SUBMITTED' || 'APPROVED'`; Fulfill click opens `Modal` confirmation â†’ `useFulfillPo`
- [ ] T059 [US5] Implement `SupplierPODetailPage` in `web/src/pages/supplier/SupplierPODetailPage.tsx`: read-only PO detail with `LineItemRow` (editable=false); Fulfill `Button` (same visibility rule); `StatusHistory` (wired in Phase 8)
- [ ] T060 [US5] Add supplier routes to `web/src/router.tsx`: `/supplier/po` â†’ `SupplierPOListPage`, `/supplier/po/:poId` â†’ `SupplierPODetailPage`

**Checkpoint**: Supplier can view and fulfill POs. Validates quickstart.md Scenario 5.

---

## Phase 8: User Story 6 â€” All Roles: View PO Status History (Priority: P3)

**Goal**: Any authenticated user sees a complete lifecycle timeline on any PO detail page â€” chronological, with actor, timestamp, and any rejection note.

**Independent Test**: Open a PO with 3+ status transitions â€” timeline shows entries in order with correct from/to/actor/timestamp/note.

### Tests for US6 (TDD â€” write first, must fail before T064+)

- [ ] T061 [US6] Write contract test for `StatusHistory` in `web/tests/contract/PODetailPage.contract.test.tsx` (append): (1) entries rendered oldest-first; (2) each entry shows fromStatus (or "â€”"), toStatus, changedById, changedAt formatted; (3) `note` displayed when non-null; (4) empty state "No status history yet" when entries is empty

### Implementation for US6

- [ ] T062 [US6] Implement `StatusHistory` component in `web/src/components/po/StatusHistory.tsx`: receives `entries: StatusHistoryEntry[]`; renders timeline list oldest-first; each item: fromStatus â†’ toStatus (with `POStatusBadge`), changedById, `formatDate(changedAt)`, and `note` block when non-null; empty state message
- [ ] T063 [US6] Wire `StatusHistory` into `PODetailPage` in `web/src/pages/buyer/PODetailPage.tsx`: render `<StatusHistory entries={po.statusHistory} />` below line items
- [ ] T064 [P] [US6] Wire `StatusHistory` into `SupplierPODetailPage` in `web/src/pages/supplier/SupplierPODetailPage.tsx`: render `<StatusHistory entries={po.statusHistory} />`
- [ ] T065 [P] [US6] Wire `StatusHistory` into `ApprovalDetailPage` in `web/src/pages/approver/ApprovalDetailPage.tsx`: render `<StatusHistory entries={po.statusHistory} />`

**Checkpoint**: Status history timeline visible for all roles. Validates quickstart.md Scenario 6.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that apply across all user stories and satisfy non-functional requirements.

- [ ] T066 Configure TanStack Query `refetchInterval: 10_000` on `usePoDetail` and `useApprovalQueue` in `web/src/hooks/usePurchaseOrders.ts` and `web/src/hooks/useApprovals.ts` â€” verifies SC-006 (status visible within 15 seconds)
- [ ] T067 [P] Add global `ErrorBoundary` wrapper in `web/src/main.tsx` that catches unhandled React errors and renders `<ErrorBanner>` fallback (prevents white screen on unexpected errors)
- [ ] T068 [P] Audit all pages for responsive layout at 768px breakpoint using Tailwind `md:` prefix â€” `POListPage`, `PODetailPage`, `ApprovalQueuePage`, `SupplierPOListPage` must be usable on tablet (SC-005)
- [ ] T069 [P] Add Tailwind `animate-pulse` loading skeleton states to `POListPage` and `ApprovalQueuePage` for initial query load (replaces blank table flash)
- [ ] T070 Run quickstart.md validation Scenarios 1â€“8 manually against running dev servers and confirm all pass
- [ ] T071 Verify frontend TypeScript build succeeds with no errors: `cd web && npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 â€” BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 â€” no story dependencies
- **US2 (Phase 4)**: Depends on Phase 2 â€” builds on US1 page (`PODetailPage` needs Submit button)
- **US3 (Phase 5)**: Depends on Phase 2 â€” independent of US1/US2 (separate pages and hooks)
- **US4 (Phase 6)**: Depends on Phase 4 (REVISION_REQUIRED state requires US2 submit to be built) and US3 (requires reject action to produce REVISION_REQUIRED PO in Playwright tests)
- **US5 (Phase 7)**: Depends on Phase 2 â€” independent of buyer/approver pages
- **US6 (Phase 8)**: Depends on Phase 3 (StatusHistory wires into PODetailPage)
- **Polish (Phase 9)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 â€” no story dependencies
- **US2 (P1)**: Can start after Phase 2 â€” adds Submit to US1's `PODetailPage`
- **US3 (P2)**: Can start after Phase 2 â€” fully independent (separate pages, hooks, API)
- **US4 (P2)**: Must follow US2 and US3 â€” revision state created by US3's reject action
- **US5 (P3)**: Can start after Phase 2 â€” fully independent
- **US6 (P3)**: Can start after Phase 3 (StatusHistory component wired into PODetailPage)

### Within Each User Story

1. Contract tests (RTL + MSW) **first** â€” must FAIL before any implementation
2. Playwright test written before or alongside implementation
3. API client functions before hooks
4. Hooks before page components
5. Sub-components before page components
6. Page component before router entry

### Parallel Opportunities

- All Phase 1 tasks marked [P] can run simultaneously
- All Phase 2 tasks marked [P] can run simultaneously (T012â€“T019)
- Once Phase 2 is complete: US1, US3, and US5 can be worked in parallel by separate developers
- Within each story: tests marked [P] can run simultaneously; API client + sub-components marked [P] can run simultaneously

---

## Parallel Example: User Story 1

```bash
# Step 1 â€” Write contract tests together (must fail before impl):
Task T022: POListPage contract test
Task T023: PODetailPage contract test (draft mode)

# Step 2 â€” API client + sub-component work in parallel:
Task T025: PO API client (web/src/api/purchaseOrders.ts)
Task T026: Line item API client (web/src/api/lineItems.ts)
Task T030: POStatusBadge component
Task T031: LockWarning component

# Step 3 â€” Hooks (depend on API clients):
Task T028: usePurchaseOrders hooks
Task T029: useLineItems hooks

# Step 4 â€” Page components (depend on hooks + sub-components):
Task T032: LineItemRow
Task T033: LineItemEditor
â†’ Then T034: POListPage, T035: POCreatePage, T036: PODetailPage
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational â€” **CRITICAL: blocks all stories**
3. Complete Phase 3: US1 (Buyer draft management)
4. **VALIDATE**: Run `npm test` contract tests; run Playwright buyer draft flow (quickstart.md Scenario 1)
5. Complete Phase 4: US2 (Buyer submit)
6. **VALIDATE**: Run quickstart.md Scenarios 1 and 2 end-to-end
7. Deploy / demo MVP buyer flow

### Incremental Delivery

1. Setup + Foundational â†’ `web/` project boots and auth shell works
2. US1 â†’ Buyers can manage draft POs â†’ validate independently
3. US2 â†’ Buyers can submit POs â†’ validate independently
4. US3 â†’ Approvers can approve/reject â†’ validate independently
5. US4 â†’ Revision loop closes â†’ validates with US3
6. US5 â†’ Supplier fulfillment works â†’ validate independently
7. US6 â†’ Status history everywhere â†’ validate independently
8. Polish â†’ All non-functional requirements met

### Parallel Team Strategy

With 3 developers after Phase 2:
- Developer A: US1 + US2 (buyer flow)
- Developer B: US3 (approver flow)
- Developer C: US5 (supplier flow)

US4 and US6 are small and can be picked up by whoever finishes first.

---

## Notes

- `[P]` tasks = different files, no blocking dependencies â€” safe to parallelize
- `[USN]` label maps task to a specific user story for traceability
- Each user story is independently completable and testable
- Contract tests (RTL + MSW) MUST be written before implementation and verified to fail first
- Playwright tests start a real Fastify backend â€” ensure `npm run dev` at repo root works before running e2e
- TanStack Query cache invalidation is critical: every mutation must invalidate the affected query keys
- All money amounts: receive as cents from API, display as dollars via `centsToDisplay()`
- APPROVAL_THRESHOLD_CENTS = 1_000_000 ($10,000) â€” used in both submit warning and Playwright test assertions
- Stop at each **Checkpoint** to validate independently before proceeding to the next phase
