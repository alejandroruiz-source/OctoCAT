# OctoCAT Purchase Order Management System

A full-stack Purchase Order (PO) management system for OctoCAT's supply chain operations. Buyers create and submit POs to suppliers, high-value orders route through an approval workflow, and suppliers confirm fulfillment — all with a complete audit trail.

---

## Overview

| Layer | Technology |
|-------|-----------|
| Backend API | TypeScript · Fastify v5 · Drizzle ORM · SQLite (WAL) |
| Frontend SPA | React 19 · TanStack Query v5 · React Router v7 · Tailwind CSS v3 |
| Auth | OIDC (`oidc-client-ts`) with dev bypass via header-based test mode |
| Testing | Vitest 2 · React Testing Library 16 · MSW v2 · Playwright |

---

## Features

### User Stories

| Story | Priority | Description |
|-------|----------|-------------|
| US1 | P1 | Create and manage Draft POs — add/edit/delete line items, cancel |
| US2 | P1 | Submit POs with expected delivery date; supplier notification via outbox |
| US3 | P2 | Approval workflow for POs ≥ $10,000 — approve, reject with reason, resubmit |
| US4 | P3 | Fulfillment tracking — supplier marks fulfilled; full status history timeline |

### Business Rules

- All money stored as **integer cents** (no floating-point arithmetic)
- Approval threshold: **$10,000** (`APPROVAL_THRESHOLD_CENTS = 1_000_000`)
- Edit lock: **30-minute pessimistic lock** prevents concurrent edits on the same draft
- Submission requires `expectedDeliveryDate` to be set
- Notifications are durable via a **SQLite outbox** — submission never blocks on notification delivery
- Cancelled and fulfilled POs are soft-deleted (never hard-deleted; full audit trail preserved)

---

## Architecture

### Backend (`src/`)

```
src/
├── lib/                        # Domain library — importable without HTTP
│   ├── models/                 # TypeBox schemas + TypeScript types
│   │   ├── purchaseOrder.ts
│   │   ├── lineItem.ts
│   │   ├── approval.ts
│   │   └── notification.ts
│   ├── services/               # Business logic
│   │   ├── poService.ts        # Create, submit, cancel, fulfill, lock/unlock
│   │   ├── lineItemService.ts  # Add, update, delete line items
│   │   ├── approvalService.ts  # Approve, reject
│   │   └── stateMachine.ts     # Valid status transitions + canEdit guard
│   ├── db/
│   │   ├── schema.ts           # Drizzle table definitions (source of truth)
│   │   ├── client.ts           # createDb(path) factory
│   │   └── migrate.ts          # runMigrations(db) helper
│   └── notifications/
│       └── outboxWorker.ts     # Polls PENDING notifications; retries up to 5×
├── api/
│   ├── plugins/
│   │   ├── auth.ts             # JWT Bearer parser; test-mode header bypass
│   │   └── swagger.ts          # @fastify/swagger + Swagger UI at /docs
│   └── routes/
│       ├── purchaseOrders.ts   # PO CRUD + state-transition endpoints
│       ├── lineItems.ts        # Line item endpoints (nested under PO)
│       └── approvals.ts        # Approve/reject endpoints
└── index.ts                    # Public library exports
```

### Frontend (`web/`)

```
web/src/
├── pages/
│   ├── buyer/          # POListPage, PODetailPage, POSubmitPage
│   ├── approver/       # ApprovalQueuePage, ApprovalDetailPage
│   └── supplier/       # SupplierPOListPage, SupplierPODetailPage
├── components/
│   ├── po/             # POStatusBadge, LineItemRow, LineItemEditor,
│   │                   # LockWarning, StatusHistory
│   └── ui/             # Button, Modal, ErrorBanner
├── hooks/              # usePurchaseOrders, useLineItems, useApprovals
├── api/                # apiFetch client, typed API functions
├── auth/               # AuthProvider (OIDC + dev bypass)
└── lib/                # formatters, constants (APPROVAL_THRESHOLD_CENTS)
```

### Data Model

Five owned tables; four external references (users, branches, suppliers, products):

| Table | Purpose |
|-------|---------|
| `purchase_orders` | Central entity; tracks full PO lifecycle |
| `line_items` | Products within a PO (quantity, unit price, extended price) |
| `approvals` | Approver decisions (APPROVED / REJECTED with reason) |
| `po_status_history` | Immutable audit log of every status transition |
| `notifications` | Outbox table for durable async delivery |

#### PO Status Machine

```
DRAFT ──(total < $10k)──► SUBMITTED ──► FULFILLED
  │                                         ▲
  └──(total ≥ $10k)──► AWAITING_APPROVAL ──┤
                               │            │
                          [reject]      [approve]──► APPROVED ──► FULFILLED
                               ▼
                       REVISION_REQUIRED ──(resubmit)──► AWAITING_APPROVAL
                               │
                          [cancel]
                               ▼
                           CANCELLED (also reachable directly from DRAFT)
```

---

## Getting Started

### Prerequisites

- Node.js 20 LTS
- npm 10+
- Windows: Visual Studio Build Tools (for `better-sqlite3`)
- macOS: `xcode-select --install`

### Backend Setup

```bash
# Install root dependencies
npm install

# Apply the database migration
npm run db:migrate

# Start the API server (port 3000)
npm run dev
# OpenAPI docs → http://localhost:3000/docs

# Start with auth disabled for local frontend development
npm run dev:local
# Sets AUTH_DISABLED=true — accepts x-test-user-id / x-test-user-role headers
```

### Frontend Setup

```bash
cd web
npm install

# Start Vite dev server (port 5173)
# AUTH_DISABLED=true skips OIDC and creates a synthetic test user
VITE_AUTH_DISABLED=true VITE_TEST_USER_ROLE=BUYER npm run dev
```

### Environment Variables

#### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `DB_PATH` | `po.db` | SQLite file path; use `:memory:` for ephemeral |
| `AUTH_DISABLED` | `false` | Enable test-mode auth (header-based, no JWT) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

#### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | Backend base URL |
| `VITE_AUTH_DISABLED` | `false` | Skip OIDC; use synthetic test user |
| `VITE_TEST_USER_ROLE` | `BUYER` | Role for test user (`BUYER`/`APPROVER`/`SUPPLIER`) |
| `VITE_TEST_USER_ID` | `test-buyer-001` | User ID injected in test-mode requests |
| `VITE_OIDC_AUTHORITY` | — | OIDC provider URL (production) |
| `VITE_OIDC_CLIENT_ID` | — | OIDC client ID (production) |

---

## API Reference

The full OpenAPI 3.0 spec is served at **`http://localhost:3000/docs`** when the server is running.

### Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/purchase-orders` | BUYER | Create a draft PO |
| `GET` | `/api/v1/purchase-orders` | BUYER | List POs (paginated, filterable by status) |
| `GET` | `/api/v1/purchase-orders/:id` | Any | Get PO detail with line items + history |
| `POST` | `/api/v1/purchase-orders/:id/submit` | BUYER | Submit PO (requires `expectedDeliveryDate`) |
| `POST` | `/api/v1/purchase-orders/:id/cancel` | BUYER | Cancel a DRAFT or REVISION_REQUIRED PO |
| `POST` | `/api/v1/purchase-orders/:id/fulfill` | SUPPLIER | Mark PO as fulfilled |
| `POST` | `/api/v1/purchase-orders/:id/lock` | BUYER | Acquire 30-min edit lock |
| `DELETE` | `/api/v1/purchase-orders/:id/lock` | BUYER | Release edit lock |
| `POST` | `/api/v1/purchase-orders/:id/line-items` | BUYER | Add a line item |
| `PATCH` | `/api/v1/purchase-orders/:id/line-items/:liId` | BUYER | Update quantity/price |
| `DELETE` | `/api/v1/purchase-orders/:id/line-items/:liId` | BUYER | Remove a line item |
| `GET` | `/api/v1/purchase-orders/approval-queue` | APPROVER | List POs awaiting approval |
| `POST` | `/api/v1/purchase-orders/:id/approve` | APPROVER | Approve a high-value PO |
| `POST` | `/api/v1/purchase-orders/:id/reject` | APPROVER | Reject with a required reason |

### Auth

**Production**: Bearer JWT with `userId` and `role` claims.

**Development** (`AUTH_DISABLED=true`): Pass headers directly:
```
x-test-user-id: buyer-001
x-test-user-role: BUYER   # BUYER | APPROVER | SUPPLIER
```

---

## Testing

### Backend Tests

```bash
# All suites
npm test

# Contract tests (OpenAPI shape tests via fastify.inject)
npm run test:contract

# Integration tests (real SQLite :memory: databases, zero mocks)
npm run test:integration

# Unit tests (state machine, price calculations)
npm run test:unit

# Coverage report
npm run test:coverage
```

### Frontend Tests

```bash
cd web

# Contract/unit tests (Vitest + React Testing Library + MSW)
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests (Playwright — auto-starts backend + frontend)
npm run test:e2e

# E2E in headed mode
npm run test:e2e:headed
```

### Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| Backend contract | Vitest + `fastify.inject()` | HTTP response shapes against OpenAPI schema |
| Backend integration | Vitest + real SQLite `:memory:` | Service logic, state machine, outbox |
| Backend unit | Vitest | Status transitions, price calculation |
| Frontend contract | Vitest + RTL + MSW v2 | Component behavior against mocked API |
| Frontend E2E | Playwright | Full buyer/submit flows against real backend |

**TDD enforcement**: Contract tests are written before implementation and must fail red before any code is written (constitution mandate).

---

## Development Scripts

### Root (backend)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API server with `tsx watch` (hot reload) |
| `npm run dev:local` | Start API with `AUTH_DISABLED=true` for frontend dev |
| `npm run build` | TypeScript compile |
| `npm test` | Run all test suites |
| `npm run db:generate` | Generate Drizzle migration from schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run web:dev` | Start frontend dev server |
| `npm run web:test` | Run frontend contract tests |
| `npm run web:e2e` | Run Playwright E2E tests |

### Frontend (`web/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | TypeScript check + Vite production build |
| `npm test` | Vitest contract tests |
| `npm run test:e2e` | Playwright E2E (starts both servers) |
| `npm run typecheck` | TypeScript check without emit |

---

## Roles

| Role | Capabilities |
|------|-------------|
| `BUYER` | Create/edit/submit/cancel POs; manage line items on own DRAFT/REVISION_REQUIRED POs |
| `APPROVER` | View all POs in `AWAITING_APPROVAL`; approve or reject with reason |
| `SUPPLIER` | View submitted/approved POs assigned to them; mark as fulfilled |

---

## Constitution

The project follows the **OctoCAT Supply Chain Constitution v1.0.0**:

1. **Library-First Architecture** — All domain logic lives in `src/lib/`; `src/api/` is a thin HTTP adapter
2. **Test-Driven Development** — Contract tests written before implementation; must fail red first
3. **Integration Tests Over Mocks** — Real SQLite `:memory:` for all data-layer tests; no database mocks
4. **Simplicity Over Abstraction** — Direct Fastify/Drizzle usage; no unnecessary abstraction layers
5. **REST API with OpenAPI Standards** — Code-first OpenAPI 3.0 via `@fastify/swagger`; spec at `/docs`
