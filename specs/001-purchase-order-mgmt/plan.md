# Implementation Plan: Purchase Order Management System

**Branch**: `001-purchase-order-mgmt` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-purchase-order-mgmt/spec.md`

## Summary

Build a Purchase Order Management System as a TypeScript library exposing a REST API. Buyers create and submit POs to suppliers; POs ≥$10,000 route through an approver workflow; rejected POs enter a Revision Required state for buyer correction before resubmission; suppliers confirm fulfillment. The implementation uses Fastify v5 for the HTTP layer, Drizzle ORM + SQLite for persistence (with a SQLite outbox pattern for durable async notifications), and Vitest for contract and integration testing — all per the OctoCAT Supply Chain Constitution.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS)

**Primary Dependencies**:
| Package | Version | Purpose |
|---------|---------|---------|
| `fastify` | `5.x` | HTTP framework (code-first OpenAPI, inject()-based testing) |
| `@fastify/swagger` | `9.x` | OpenAPI 3.0 generation from route schemas |
| `@fastify/swagger-ui` | `5.x` | Swagger UI at `/docs` |
| `@sinclair/typebox` | `0.34.x` | Single-source schemas → JSON Schema + TypeScript types |
| `drizzle-orm` | `0.31.x` | SQLite ORM (schema-as-code, no runtime codegen) |
| `drizzle-kit` | `0.22.x` | Migration CLI (devDependency) |
| `better-sqlite3` | `9.6.x` | Synchronous SQLite driver |
| `@types/better-sqlite3` | `7.6.x` | Driver TypeScript types |
| `vitest` | `2.x` | Test runner (native TypeScript, Jest-compatible API) |
| `@vitest/coverage-v8` | `2.x` | Coverage reporting |
| `uuid` | `9.x` | UUID generation for entity IDs |

**Storage**: SQLite, WAL journal mode, single-file (`po.db`). Tests use `:memory:` per suite via `createDb()` factory.

**Testing**: Vitest 2.x. Three suites:
- `tests/contract/` — OpenAPI shape tests against `fastify.inject()` (written before implementation; must fail red before any code)
- `tests/integration/` — Real SQLite `:memory:` databases; Drizzle migrations applied in `beforeAll`; no mocks
- `tests/unit/` — Pure business logic (state machine validation, price calculation)

**Target Platform**: Node.js 20 LTS, single-instance REST API service.

**Project Type**: Library (`src/lib/`) with a REST API adapter (`src/api/`). Library is independently importable and testable without the HTTP layer.

**Performance Goals**:
- SC-001: API response latency <200ms p95 for all CRUD operations; PO creation flow under 3 minutes (UX target)
- SC-002: Notification delivery within 10 seconds of PO submission (outbox worker polls every 5 seconds)
- SC-005: Approval SLA 24 business hours — surfaced in API response (`approvalDeadline` field); enforcement is operational (alerting), not system-blocking

**Constraints**:
- All money values stored and transmitted as integer cents (no floating-point arithmetic)
- `expected_delivery_date` required at submission time (not at draft creation)
- No mocks for data-layer tests (constitution mandate)
- No external infrastructure; notifications via SQLite outbox pattern
- SQLite `:memory:` per test file; no shared state between test files
- WAL journal mode enabled for all database connections

**Scale/Scope**: MVP single-instance. SQLite WAL supports concurrent reads with a single writer. No horizontal scaling requirements for v1.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|---------|
| I. Library-First Architecture | ✅ PASS | All business logic in `src/lib/`; `src/api/` is a thin Fastify adapter; `src/index.ts` exports library API with no HTTP dependency |
| II. Test-Driven Development | ✅ PASS | Contract tests in `tests/contract/` are written before any implementation and must fail initially; `tasks.md` will enforce red-green-refactor ordering |
| III. Integration Tests over Mocks | ✅ PASS | `createDb(":memory:")` factory provides real SQLite per integration test suite; `migrate()` in `beforeAll`; zero database mocking |
| IV. Simplicity over Abstraction | ✅ PASS | Fastify (no decorators), Drizzle (SQL-like API, zero runtime codegen), no custom middleware chains, no repository pattern beyond direct service calls |
| V. REST API with OpenAPI Standards | ✅ PASS | `@fastify/swagger` v9 generates OpenAPI 3.0 code-first from TypeBox route schemas; spec served at `/docs`; contract defined in `contracts/openapi.yaml` |

**No constitution violations. Complexity Tracking table not required.**

## Project Structure

### Documentation (this feature)

```text
specs/001-purchase-order-mgmt/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output (/speckit-plan)
├── data-model.md        # Phase 1 output (/speckit-plan)
├── quickstart.md        # Phase 1 output (/speckit-plan)
├── contracts/
│   └── openapi.yaml     # Phase 1 output — OpenAPI 3.0 contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── models/
│   │   ├── purchaseOrder.ts    # TypeBox schema + PurchaseOrder type
│   │   ├── lineItem.ts         # TypeBox schema + LineItem type
│   │   ├── approval.ts         # TypeBox schema + Approval type
│   │   └── notification.ts     # TypeBox schema + Notification type
│   ├── services/
│   │   ├── poService.ts        # create, submit, cancel, fulfill, lock/unlock
│   │   ├── lineItemService.ts  # add, update, delete line items
│   │   └── approvalService.ts  # approve, reject
│   ├── db/
│   │   ├── schema.ts           # Drizzle table definitions (source of truth)
│   │   ├── client.ts           # createDb(path) factory
│   │   └── migrate.ts          # runMigrations(db) helper
│   └── notifications/
│       └── outboxWorker.ts     # Poll PENDING notifications + retry loop
├── api/
│   ├── plugins/
│   │   ├── swagger.ts          # @fastify/swagger + @fastify/swagger-ui registration
│   │   └── auth.ts             # JWT Bearer role-extractor plugin
│   └── routes/
│       ├── purchaseOrders.ts   # PO CRUD + state-transition routes
│       ├── lineItems.ts        # Line item routes (nested under PO)
│       └── approvals.ts        # Approve/reject routes
└── index.ts                    # Public library entry point (exports services + types)

tests/
├── contract/                   # OpenAPI contract tests (written BEFORE implementation)
│   ├── purchaseOrders.contract.test.ts
│   ├── lineItems.contract.test.ts
│   └── approvals.contract.test.ts
├── integration/                # Real SQLite integration tests
│   ├── poService.integration.test.ts
│   ├── lineItemService.integration.test.ts
│   ├── approvalService.integration.test.ts
│   └── outboxWorker.integration.test.ts
└── unit/
    ├── stateMachine.unit.test.ts   # Valid/invalid status transitions
    └── priceCalculation.unit.test.ts

drizzle/                        # SQL migration files (drizzle-kit output)
├── 0000_initial_schema.sql
└── meta/
    └── _journal.json
```

**Structure Decision**: Single-project layout. Core business logic lives in `src/lib/` and is independently importable without Fastify. The REST API in `src/api/` is a thin adapter that maps HTTP requests to library service calls — directly implementing the Library-First principle.

## Complexity Tracking

> No constitution violations — this section is not required.
