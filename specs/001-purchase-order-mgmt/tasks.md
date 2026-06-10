# Tasks: Purchase Order Management System

**Input**: Design documents from `specs/001-purchase-order-mgmt/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**TDD Mandate** (OctoCAT Supply Chain Constitution §II): All test tasks MUST be written first and confirmed FAILING before any implementation task in the same phase begins. The red-green-refactor cycle is strictly enforced.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks in same phase)
- **[Story]**: Which user story this task belongs to (US1–US4, maps to spec.md priorities)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — creates the skeleton every other phase depends on.

- [ ] T001 Initialize Node.js project: create `package.json` with `name`, `type: "module"`, and all npm scripts (`dev`, `build`, `test`, `test:contract`, `test:integration`, `test:unit`, `test:coverage`)
- [ ] T002 Install all production dependencies: `fastify@5`, `@fastify/swagger@9`, `@fastify/swagger-ui@5`, `@sinclair/typebox@0.34`, `drizzle-orm@0.31`, `better-sqlite3@9.6`, `uuid@9`
- [ ] T003 [P] Install all devDependencies: `drizzle-kit@0.22`, `@types/better-sqlite3`, `@types/uuid`, `vitest@2`, `@vitest/coverage-v8`, `tsx`, `typescript@5`
- [ ] T004 [P] Create `tsconfig.json` with `"moduleResolution": "bundler"`, strict mode enabled, path aliases for `src/` and configure `vitest.config.ts` with three test projects (`contract/`, `integration/`, `unit/`) using `globals: true`

**Checkpoint**: `npm install` succeeds; `npx tsc --noEmit` passes on empty `src/index.ts`; `npm test` runs (zero tests found is acceptable at this stage).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: These tasks block all Phase 3+ work.

### Database Layer

- [ ] T005 Create Drizzle table definitions for all five owned entities (`purchase_orders`, `line_items`, `approvals`, `po_status_history`, `notifications`) in `src/lib/db/schema.ts` — include all columns, CHECK constraints, foreign keys, and DEFAULT values from `data-model.md`
- [ ] T006 Implement `createDb(path: string): BetterSQLite3Database` factory in `src/lib/db/client.ts` — enable WAL journal mode and foreign keys pragma on every connection; export factory for test injection
- [ ] T007 Implement `runMigrations(db)` helper in `src/lib/db/migrate.ts` using `drizzle-orm/better-sqlite3/migrator`
- [ ] T008 Generate initial SQL migration from the Drizzle schema: run `npx drizzle-kit generate:sqlite --schema=src/lib/db/schema.ts --out=drizzle/` — commit output as `drizzle/0000_initial_schema.sql`

### Type Models

- [ ] T009 [P] Create TypeBox schemas and inferred TypeScript types for `PurchaseOrder` (all request/response shapes from `contracts/openapi.yaml`) in `src/lib/models/purchaseOrder.ts`
- [ ] T010 [P] Create TypeBox schemas and inferred TypeScript types for `LineItem` (request/response shapes) in `src/lib/models/lineItem.ts`
- [ ] T011 [P] Create TypeBox schemas and inferred TypeScript types for `Approval` (request/response shapes) in `src/lib/models/approval.ts`
- [ ] T012 [P] Create TypeBox schemas and inferred TypeScript types for `Notification` (outbox payload shape) in `src/lib/models/notification.ts`

### Business Logic Primitives

- [ ] T013 [P] Implement PO status state machine in `src/lib/services/stateMachine.ts`: export `VALID_TRANSITIONS` map (from `data-model.md`) and `validateTransition(from, to, actorRole): void` — throws `InvalidStatusTransitionError` on invalid transition
- [ ] T014 [P] Implement price calculation utilities in `src/lib/services/pricing.ts`: `computeExtendedPriceCents(qty, unitPriceCents): number` and `computeTotalCents(lineItems): number`

### API App Skeleton

- [ ] T015 Create Fastify app factory `buildApp(db): FastifyInstance` in `src/api/app.ts` — register swagger and auth plugins; export factory for inject()-based testing
- [ ] T016 [P] Implement JWT Bearer role-extractor auth plugin in `src/api/plugins/auth.ts` — decorates `request` with `{ userId, role }` from JWT; returns 401 if token missing/invalid; returns 403 if role claim absent
- [ ] T017 [P] Register `@fastify/swagger` and `@fastify/swagger-ui` in `src/api/plugins/swagger.ts` — configure OpenAPI 3.0 info block and `/docs` route prefix

### Foundational Tests (TDD — must fail red before T013–T014 implementation)

- [ ] T018 [P] Write unit tests for state machine valid/invalid transitions (all rows from `data-model.md` Valid Transitions table) in `tests/unit/stateMachine.unit.test.ts` — **confirm failing before implementing T013**
- [ ] T019 [P] Write unit tests for price calculation edge cases (zero items, single item, multi-item sum) in `tests/unit/priceCalculation.unit.test.ts` — **confirm failing before implementing T014**

**Checkpoint**: `npm run test:unit` reports all tests failing (red). `buildApp(db)` returns a Fastify instance. `createDb(":memory:")` + `runMigrations()` creates a working in-memory SQLite database with all five tables.

---

## Phase 3: User Story 1 — Create and Manage Draft Purchase Orders (Priority: P1) 🎯 MVP

**Goal**: Buyers can create draft POs, add/edit/delete line items, acquire edit locks, update PO metadata, and cancel drafts.

**Independent Test**: Create a PO, add 3 line items, edit one, delete another, verify total recalculates, acquire lock, verify second buyer cannot acquire lock, cancel PO. No notifications, approvals, or fulfillment required.

### Tests for User Story 1 (TDD — write first, confirm failing before implementing T027+)

- [ ] T020 [P] [US1] Write contract test for `POST /api/v1/purchase-orders` (201 with DRAFT status, poNumber format) and `GET /api/v1/purchase-orders` (200 list, role filtering header) in `tests/contract/purchaseOrders.contract.test.ts`
- [ ] T021 [P] [US1] Write contract test for `GET /api/v1/purchase-orders/:poId` (200 PurchaseOrderDetailResponse shape) and `PATCH /api/v1/purchase-orders/:poId` (200, 409 for non-DRAFT status) in `tests/contract/purchaseOrders.contract.test.ts`
- [ ] T022 [P] [US1] Write contract test for `POST /api/v1/purchase-orders/:poId/cancel` (200 CANCELLED) and `POST/DELETE /api/v1/purchase-orders/:poId/lock` (200 LockResponse / 204) in `tests/contract/purchaseOrders.contract.test.ts`
- [ ] T023 [P] [US1] Write contract test for line item endpoints: `POST` (201 LineItemResponse with computed extendedPriceCents), `PATCH` (200), `DELETE` (204), 409 when PO status is SUBMITTED in `tests/contract/lineItems.contract.test.ts`
- [ ] T024 [P] [US1] Write integration test for PO draft lifecycle: create → add line items → edit quantity → delete line item → verify totalCents recalculates atomically → cancel in `tests/integration/poService.integration.test.ts`
- [ ] T025 [P] [US1] Write integration test for line item service: add with totalCents sync, update with extended price recompute, delete with totalCents sync, reject zero/negative quantity in `tests/integration/lineItemService.integration.test.ts`
- [ ] T026 [P] [US1] Write integration test for pessimistic lock: buyer A acquires lock → buyer B attempt returns conflict → lock expiry after 30 min (mock time) → buyer B acquires after expiry in `tests/integration/poService.integration.test.ts`

### Implementation for User Story 1

- [ ] T027 [US1] Implement `poService.create()` (insert PO in DRAFT, generate PO number, record initial status history) and `poService.generatePoNumber()` in `src/lib/services/poService.ts`
- [ ] T028 [US1] Implement `poService.getById()` (with line items + history, role-visibility check) and `poService.list()` (paginated, role-filtered, status filter) in `src/lib/services/poService.ts`
- [ ] T029 [US1] Implement `poService.update()` (PATCH metadata: notes, expectedDeliveryDate; DRAFT/REVISION_REQUIRED only; lock check) and `poService.cancel()` (DRAFT/REVISION_REQUIRED → CANCELLED; record history) in `src/lib/services/poService.ts`
- [ ] T030 [US1] Implement `poService.acquireLock()` (BEGIN IMMEDIATE; check expiry; set locked_by + locked_at) and `poService.releaseLock()` (clear lock columns; idempotent) in `src/lib/services/poService.ts`
- [ ] T031 [US1] Implement `lineItemService.add()`, `update()`, `delete()` — each method must atomically recompute `extended_price_cents` and update `purchase_orders.total_cents` within a single SQLite transaction in `src/lib/services/lineItemService.ts`
- [ ] T032 [US1] Implement `POST /api/v1/purchase-orders` and `GET /api/v1/purchase-orders` routes (with TypeBox request/response schemas for OpenAPI generation) in `src/api/routes/purchaseOrders.ts`
- [ ] T033 [US1] Implement `GET /api/v1/purchase-orders/:poId` (detail with lineItems + history) and `PATCH /api/v1/purchase-orders/:poId` routes in `src/api/routes/purchaseOrders.ts`
- [ ] T034 [US1] Implement `POST /api/v1/purchase-orders/:poId/cancel`, `POST /api/v1/purchase-orders/:poId/lock`, and `DELETE /api/v1/purchase-orders/:poId/lock` routes in `src/api/routes/purchaseOrders.ts`
- [ ] T035 [US1] Implement all line item routes (`POST`, `PATCH`, `DELETE` under `/api/v1/purchase-orders/:poId/line-items`) in `src/api/routes/lineItems.ts`
- [ ] T036 [US1] Register `purchaseOrders` and `lineItems` route plugins in `src/api/app.ts`; run `npm run test:contract` and `npm run test:integration` — all US1 tests must pass green

**Checkpoint**: US1 fully functional. `npm run test:contract` and `npm run test:integration` pass for US1 scope. `npm run test:unit` passes. A buyer can create a PO, manage line items, lock, edit, and cancel — independently of any notification or approval logic.

---

## Phase 4: User Story 2 — Submit Purchase Orders and Notify Suppliers (Priority: P1)

**Goal**: Buyers submit draft POs; routing logic applies ($10k threshold); supplier receives async notification; submitted POs become read-only.

**Independent Test**: Submit a PO under $10k → verify status = SUBMITTED; verify `notifications` table has a PENDING row for the supplier. Attempt to edit submitted PO → expect 409. (Run outbox worker in tests; no real email delivery required.)

### Tests for User Story 2 (TDD — write first, confirm failing before implementing T039+)

- [ ] T037 [P] [US2] Write contract test for `POST /api/v1/purchase-orders/:poId/submit`: 200 SUBMITTED for under-threshold, 422 for zero line items, 422 for missing expectedDeliveryDate, 409 for wrong status in `tests/contract/purchaseOrders.contract.test.ts`
- [ ] T038 [P] [US2] Write integration test for submission below $10k: submit → status = SUBMITTED → notifications table contains PENDING row for supplier (PO_SUBMITTED event) → outbox worker delivers → status = SENT in `tests/integration/outboxWorker.integration.test.ts`

### Implementation for User Story 2

- [ ] T039 [US2] Implement `poService.submit()` in `src/lib/services/poService.ts`: validate ≥1 line item; validate expectedDeliveryDate is future date; route to SUBMITTED (total < $1,000,000 cents) or AWAITING_APPROVAL (total ≥ $1,000,000 cents); insert notification rows atomically within submission transaction; record status history
- [ ] T040 [US2] Implement `outboxWorker` in `src/lib/notifications/outboxWorker.ts`: `start(db, notificationService, intervalMs)` polls for PENDING/retryable rows every 5s; calls notification service; marks SENT or increments retry_count; stops after 5 failures (FAILED); export `stop()` for clean shutdown
- [ ] T041 [US2] Implement `POST /api/v1/purchase-orders/:poId/submit` route with 422 responses for business rule violations in `src/api/routes/purchaseOrders.ts`; lock is auto-released on successful submit
- [ ] T042 [US2] Verify read-only enforcement: confirm PATCH, add/update/delete line item, and lock endpoints all return 409 for POs in SUBMITTED, APPROVED, AWAITING_APPROVAL, FULFILLED, or CANCELLED status — add assertions to existing contract tests in `tests/contract/`

**Checkpoint**: US2 fully functional. Buyers can submit POs; routing threshold is enforced; notifications queue correctly. Submitted POs reject all edit operations with 409.

---

## Phase 5: User Story 3 — Approval Workflow for High-Value POs (Priority: P2)

**Goal**: POs ≥$10k route to AWAITING_APPROVAL; approvers approve or reject; rejection enters REVISION_REQUIRED for buyer to revise and resubmit; full approval cycle covered.

**Independent Test**: Submit a $150,000 PO → verify AWAITING_APPROVAL + approvalDeadline present; approver approves → APPROVED + supplier notified; separately: approver rejects with reason → REVISION_REQUIRED → buyer revises and resubmits → AWAITING_APPROVAL again.

### Tests for User Story 3 (TDD — write first, confirm failing before implementing T047+)

- [ ] T043 [P] [US3] Write contract test for `POST /api/v1/purchase-orders/:poId/approve`: 200 ApprovalResponse, 403 for BUYER role, 409 for wrong PO status in `tests/contract/approvals.contract.test.ts`
- [ ] T044 [P] [US3] Write contract test for `POST /api/v1/purchase-orders/:poId/reject`: 200 ApprovalResponse, 400 when reason is absent, 403 for non-APPROVER role in `tests/contract/approvals.contract.test.ts`
- [ ] T045 [P] [US3] Write integration test for high-value submit routing: PO total ≥ $10k → status = AWAITING_APPROVAL; `approvalDeadline` = submittedAt + 24 business hours; APPROVAL_REQUESTED notification queued for all APPROVERs in `tests/integration/poService.integration.test.ts`
- [ ] T046 [P] [US3] Write integration test for approval: AWAITING_APPROVAL → approve → APPROVED; PO_APPROVED notification queued for supplier; approval record inserted in `approvals` table in `tests/integration/approvalService.integration.test.ts`
- [ ] T047 [P] [US3] Write integration test for full rejection-revision-resubmit cycle: reject with reason → REVISION_REQUIRED; buyer edits line item; resubmits → AWAITING_APPROVAL; approves → APPROVED; two rows in `approvals` table; complete status history recorded in `tests/integration/approvalService.integration.test.ts`

### Implementation for User Story 3

- [ ] T048 [US3] Implement `approvalService.approve()` in `src/lib/services/approvalService.ts`: validate PO is AWAITING_APPROVAL; validate caller has APPROVER role; insert approval record (APPROVED); transition PO to APPROVED; record status history; queue PO_APPROVED notification for supplier
- [ ] T049 [US3] Implement `approvalService.reject()` in `src/lib/services/approvalService.ts`: validate PO is AWAITING_APPROVAL; require reason; insert approval record (REJECTED); transition PO to REVISION_REQUIRED; record status history; queue PO_REJECTED notification for buyer (with reason); queue PO_ON_HOLD notification for supplier
- [ ] T050 [US3] Add `approvalDeadline` computation to `poService.getById()` and PO list responses in `src/lib/services/poService.ts`: `approvalDeadline = submittedAt + 24 business hours`; only present when status is AWAITING_APPROVAL
- [ ] T051 [US3] Implement `POST /api/v1/purchase-orders/:poId/approve` route in `src/api/routes/approvals.ts` with APPROVER role guard
- [ ] T052 [US3] Implement `POST /api/v1/purchase-orders/:poId/reject` route in `src/api/routes/approvals.ts` with APPROVER role guard and required `reason` body validation
- [ ] T053 [US3] Register `approvals` route plugin in `src/api/app.ts`; run all US3 tests — must pass green

**Checkpoint**: US3 fully functional. Submit a ≥$10k PO; approve and reject paths both work including the REVISION_REQUIRED → resubmit cycle. `npm run test:contract` and `npm run test:integration` fully green for US1–US3.

---

## Phase 6: User Story 4 — Track PO Status and Fulfillment (Priority: P3)

**Goal**: Suppliers mark POs as fulfilled; all roles view the complete status history timeline; role-based visibility rules enforced end-to-end.

**Independent Test**: Approve a PO; supplier marks fulfilled → status = FULFILLED with fulfilledAt timestamp; retrieve status history → array shows all transitions in order; buyer cannot see another buyer's PO; supplier cannot see DRAFT POs.

### Tests for User Story 4 (TDD — write first, confirm failing before implementing T057+)

- [ ] T054 [P] [US4] Write contract test for `POST /api/v1/purchase-orders/:poId/fulfill`: 200 FULFILLED, 403 for BUYER role, 409 for non-SUBMITTED/APPROVED status in `tests/contract/purchaseOrders.contract.test.ts`
- [ ] T055 [P] [US4] Write contract test for `GET /api/v1/purchase-orders/:poId/history`: 200 array of StatusHistoryEntry in chronological order in `tests/contract/purchaseOrders.contract.test.ts`
- [ ] T056 [P] [US4] Write integration test for fulfillment: SUBMITTED → FULFILLED (no-approval path); APPROVED → FULFILLED (approval path); fulfilledAt timestamp set; FULFILLED is terminal (further transitions return 409) in `tests/integration/poService.integration.test.ts`
- [ ] T057 [P] [US4] Write integration test for status history completeness: full lifecycle (DRAFT → SUBMITTED → AWAITING_APPROVAL → REVISION_REQUIRED → AWAITING_APPROVAL → APPROVED → FULFILLED) produces exactly seven history rows with correct `from_status`, `to_status`, `changed_by_id` values in `tests/integration/poService.integration.test.ts`

### Implementation for User Story 4

- [ ] T058 [US4] Implement `poService.fulfill()` in `src/lib/services/poService.ts`: validate caller has SUPPLIER role and is the PO's supplier; validate PO is SUBMITTED or APPROVED; transition to FULFILLED; set `fulfilled_at`; record status history
- [ ] T059 [US4] Enforce role-based visibility in `poService.getById()` and `poService.list()` in `src/lib/services/poService.ts`: BUYER sees only own POs; SUPPLIER sees only POs with matching `supplier_id` and status ≠ DRAFT; APPROVER sees all POs
- [ ] T060 [US4] Implement `GET /api/v1/purchase-orders/:poId/history` route (returns `po_status_history` rows ordered by `changed_at` ASC) in `src/api/routes/purchaseOrders.ts`
- [ ] T061 [US4] Implement `POST /api/v1/purchase-orders/:poId/fulfill` route with SUPPLIER role guard in `src/api/routes/purchaseOrders.ts`; run all US4 tests — must pass green

**Checkpoint**: US4 fully functional. All four user stories independently testable and green. Full lifecycle from DRAFT to FULFILLED (or CANCELLED) works end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Server entrypoint, library exports, spec conformance, and end-to-end validation.

- [ ] T062 [P] Create API server entrypoint in `src/api/server.ts`: instantiate `createDb("po.db")`, run migrations, build Fastify app, start outbox worker, call `app.listen({ port: 3000 })` — handle graceful shutdown (SIGTERM: stop outbox worker, close DB)
- [ ] T063 [P] Export all public service functions and TypeScript types from `src/index.ts` (library entry point): `poService`, `lineItemService`, `approvalService`, `createDb`, `runMigrations`, and all TypeBox-inferred types
- [ ] T064 [P] Validate the live OpenAPI spec served at `/docs/json` matches the shape of `contracts/openapi.yaml`: run `npm run dev` and assert all 14 endpoint `operationId` values are present in the generated spec
- [ ] T065 Run `quickstart.md` Scenario 1 end-to-end: low-value PO full lifecycle (DRAFT → SUBMITTED → FULFILLED) — all 8 steps must return expected status codes and bodies
- [ ] T066 Run `quickstart.md` Scenario 2 end-to-end: high-value PO approval path (DRAFT → AWAITING_APPROVAL → APPROVED → FULFILLED) — verify `approvalDeadline` present and role guard on approve
- [ ] T067 Run `quickstart.md` Scenario 3 end-to-end: rejection and resubmission (AWAITING_APPROVAL → REVISION_REQUIRED → AWAITING_APPROVAL → APPROVED) — verify two `approvals` rows and full status history

**Checkpoint**: `npm test` (all suites) fully green. All three quickstart scenarios pass. `src/index.ts` is importable as a standalone library.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Requires Phase 1 complete — **blocks all user story phases**
- **Phase 3 (US1)**: Requires Phase 2 complete — no other story dependencies
- **Phase 4 (US2)**: Requires Phase 2 + US1 poService/lineItemService complete (submit builds on create/draft)
- **Phase 5 (US3)**: Requires Phase 2 + US2 submit complete (approval requires submitted POs)
- **Phase 6 (US4)**: Requires Phase 2 + US3 approve complete (fulfillment requires approved POs)
- **Phase 7 (Polish)**: Requires all US phases complete

### User Story Dependencies

| Story | Depends On | Reason |
|-------|-----------|--------|
| US1 (Draft PO) | Phase 2 only | No upstream story dependency |
| US2 (Submit) | US1 complete | submit() extends poService built in US1 |
| US3 (Approval) | US2 complete | Approval workflow triggered by high-value submission |
| US4 (Fulfillment) | US3 complete | Fulfill requires SUBMITTED or APPROVED status |

### Within Each Phase

1. Write ALL tests for the phase first — confirm they fail red
2. Models / DB entities → Business logic (services) → HTTP routes → Registration
3. Mark phase complete only when all tests in that phase pass green

---

## Parallel Opportunities

### Phase 2 (Foundational) — can run in parallel:

```
T009 TypeBox: PurchaseOrder model
T010 TypeBox: LineItem model         ← all 4 models parallel
T011 TypeBox: Approval model
T012 TypeBox: Notification model

T013 State machine                   ← parallel with models
T014 Price calculation utils

T016 Auth plugin                     ← parallel with T017
T017 Swagger plugin

T018 Unit test: state machine        ← parallel with T019
T019 Unit test: price calculation
```

### Phase 3 (US1) — test writing can run in parallel:

```
T020 Contract: create/list POs
T021 Contract: get/patch PO          ← all contract tests parallel
T022 Contract: cancel/lock
T023 Contract: line items

T024 Integration: PO lifecycle       ← all integration tests parallel
T025 Integration: line item service
T026 Integration: lock behaviour
```

### Phases 4–6 — each phase's tests can run in parallel within the phase.

---

## Parallel Example: Phase 2 (Foundation)

```bash
# All four TypeBox model files are independent — create together:
Task T009: src/lib/models/purchaseOrder.ts
Task T010: src/lib/models/lineItem.ts
Task T011: src/lib/models/approval.ts
Task T012: src/lib/models/notification.ts

# Auth and Swagger plugins are independent — create together:
Task T016: src/api/plugins/auth.ts
Task T017: src/api/plugins/swagger.ts

# Unit tests are independent — write together (must fail):
Task T018: tests/unit/stateMachine.unit.test.ts
Task T019: tests/unit/priceCalculation.unit.test.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2 — P1 Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation (CRITICAL — blocks everything)
3. Complete Phase 3: US1 (draft PO management)
4. **VALIDATE**: Buyers can create, edit, lock, and cancel draft POs
5. Complete Phase 4: US2 (submit + notifications)
6. **STOP AND DEMO**: End-to-end PO submission with async notifications working
7. This constitutes a shippable MVP — approval and fulfillment can follow

### Incremental Delivery

| Milestone | Stories | What's Deliverable |
|-----------|---------|-------------------|
| M1 | US1 | Buyers manage draft POs with full line item CRUD |
| M2 | US1+US2 | POs submitted to suppliers; async notifications working |
| M3 | US1+US2+US3 | Approval workflow with revision/resubmit cycle |
| M4 | US1–US4 | Full lifecycle including supplier fulfillment + history |

### Parallel Team Strategy

With multiple developers (after Phase 2 complete):
- Dev A: US1 (draft management)
- Dev B: US2 (submit/notifications) — can start after US1 poService is scaffolded
- Dev C: US3 (approval) — can start after US2 submit is complete

---

## Notes

- `[P]` tasks touch different files or test files with no shared state — safe to run concurrently
- Every service method that transitions PO status MUST insert a `po_status_history` row in the same transaction
- All money arithmetic uses integer cents — no `number` arithmetic with dollar decimals anywhere in the codebase
- `extendedPriceCents` is ALWAYS server-computed; never accept it from client input
- Contract tests use `fastify.inject()` — no live port needed; app is built with `buildApp(createDb(":memory:"))`
- Integration tests use `createDb(":memory:")` + `runMigrations(db)` in `beforeAll` — each test file gets isolated DB
- Commit after each phase checkpoint (not each individual task)
- Stop at any checkpoint to validate the story independently before proceeding
