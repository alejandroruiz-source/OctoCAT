# Research: Purchase Order Management System

**Date**: 2026-06-10
**Branch**: `001-purchase-order-mgmt`
**Phase**: Phase 0 — Technology Resolution

---

## Decision 1: HTTP Framework

**Decision**: Fastify v5

**Rationale**: Fastify is the strongest fit against all stated constraints:
- Native TypeScript types ship with the package — no `@types/*` shim. Route handler input/output types flow automatically from the attached JSON Schema.
- `@fastify/swagger` v9 generates OpenAPI 3.0 code-first from route schemas; no separate YAML to maintain.
- `@fastify/swagger-ui` v5 serves Swagger UI in one plugin registration.
- `fastify.inject()` fires HTTP requests against the app instance with no live socket — ideal for isolated, port-free contract testing.
- No decorators; routes are plain function calls (Simplicity principle).
- v5 is current stable (Oct 2024), 10M+ weekly downloads, maintained by a paid team.

**Alternatives considered**:
- Express v5: Weaker TypeScript ergonomics; OpenAPI requires third-party validation plugins with more ceremony.
- NestJS: Ruled out — decorator-heavy; conflicts directly with Simplicity principle.
- Hapi: Niche; OpenAPI tooling lags behind.

**Key packages**:
| Package | Version |
|---------|---------|
| `fastify` | `5.x` |
| `@fastify/swagger` | `9.x` |
| `@fastify/swagger-ui` | `5.x` |

**v5 gotchas**:
- `app.listen()` returns a Promise — always `await` it; callback form removed.
- Prefer `return` from route handlers over `reply.send()` (idiomatic v5).
- `@fastify/swagger` v9 requires Fastify v5; do not mix plugin versions.
- Configure `ajv` options at `Fastify({ ajv: { ... } })` construction time, not as a plugin.

---

## Decision 2: Schema & Type System

**Decision**: TypeBox (`@sinclair/typebox`) v0.34.x

**Rationale**: TypeBox defines a schema once and derives both the JSON Schema (for Fastify validation + OpenAPI generation) and the TypeScript type from it. This eliminates the manual type-schema synchronisation that is a hidden source of drift in TypeScript REST APIs. It integrates natively with Fastify v5 as the preferred schema provider.

**Alternatives considered**:
- Zod: Popular but requires the `fastify-type-provider-zod` adapter; TypeBox is first-party recommended by Fastify.
- Raw JSON Schema + manual TS types: No single source of truth; types drift from schemas as the API evolves.

**Key packages**:
| Package | Version |
|---------|---------|
| `@sinclair/typebox` | `0.34.x` |

---

## Decision 3: Database ORM / Query Builder

**Decision**: Drizzle ORM v0.31.x + `better-sqlite3` v9.6.x

**Rationale**: Drizzle provides a TypeScript-first schema definition with a SQL-like query API, a built-in migration CLI (`drizzle-kit`), and a first-class `better-sqlite3` dialect. It requires zero code generation at runtime. The `createDb(path)` factory pattern lets each integration test suite receive an isolated in-memory SQLite database — directly enabling the "Integration Tests over Mocks" principle with no teardown overhead.

**Alternatives considered**:
- Prisma: Requires `prisma generate` (codegen in build pipeline); singleton `PrismaClient` complicates per-suite test isolation; higher abstraction than needed.
- Kysely: Excellent type safety but no built-in migration story — requires bolting on a separate tool for no functional gain over Drizzle.
- Raw `better-sqlite3`: Maximum control but verbose and untypes; no schema-level type inference.

**Key packages**:
| Package | Version |
|---------|---------|
| `drizzle-orm` | `0.31.x` |
| `drizzle-kit` | `0.22.x` (devDependency only) |
| `better-sqlite3` | `9.6.x` |
| `@types/better-sqlite3` | `7.6.x` |

**Integration test isolation pattern**:
```typescript
const db = createDb(":memory:");
beforeAll(() => migrate(db, { migrationsFolder: "./drizzle" }));
```

Each test file gets a fresh in-memory database; no file cleanup needed.

**Node 20 + TypeScript 5 gotchas**:
- `better-sqlite3` is a native addon; CI must have build tooling or prebuild binaries available.
- Use `"moduleResolution": "bundler"` or `"node16"` in `tsconfig.json`; Drizzle ships ESM + CJS and `"node10"` resolution misses exports.
- Enable WAL journal mode (`sqlite.pragma("journal_mode = WAL")`) in integration tests to avoid lock contention with parallel workers.
- `drizzle-kit` never runs at application startup; it is a devDependency only.

---

## Decision 4: Testing Framework

**Decision**: Vitest v2.x

**Rationale**: Vitest offers native TypeScript support without `ts-jest`/`babel-jest` transform configuration, faster test runs than Jest, and a Jest-compatible API (near-zero migration cost). It integrates cleanly with Fastify's `inject()` and Drizzle's in-memory SQLite setup. A single `vitest.config.ts` configures test environments, coverage, and isolation.

**Alternatives considered**:
- Jest + ts-jest: Functional but requires transform config; slower startup; no native ESM support out-of-the-box.
- Node test runner: Lacks snapshot support, coverage integrations, and ecosystem maturity for this use case.

**Key packages**:
| Package | Version |
|---------|---------|
| `vitest` | `2.x` |
| `@vitest/coverage-v8` | `2.x` |

---

## Decision 5: Notification Queue Strategy

**Decision**: SQLite Outbox Pattern

**Rationale**: Per the clarification in the spec, PO submissions must not fail if the notification service is unavailable. An outbox table in the same SQLite database provides durable, crash-safe notification queuing with no external infrastructure (no Redis, no RabbitMQ). A background worker polls the `notifications` table for `PENDING` records and attempts delivery, incrementing `retry_count` on failure (max 5 retries, exponential backoff). This satisfies SC-002 (≤10s notification delivery) under normal conditions while guaranteeing eventual delivery.

**Alternatives considered**:
- BullMQ (Redis-backed): Heavyweight — requires Redis; violates "no additional infrastructure for MVP" constraint.
- In-process event emitter with retry: Not durable across process restarts; notifications lost on crash.
- External job queue service: Adds operational complexity beyond MVP scope.

**Outbox worker behaviour**:
- Polls every 5 seconds for `PENDING` or `FAILED` (retry_count < 5) notifications.
- On delivery success: sets `status = SENT`, records `sent_at`.
- On delivery failure: increments `retry_count`, sets `last_attempt_at`; marks `FAILED` after 5 attempts.

---

## Decision 6: Pessimistic Locking for Concurrent PO Edits

**Decision**: Application-level lock columns + SQLite `BEGIN IMMEDIATE` transactions

**Rationale**: SQLite does not support `SELECT FOR UPDATE`. The spec requires pessimistic locking for concurrent draft PO edits. Solution: `locked_by` (userId) and `locked_at` (Unix timestamp) columns on the `purchase_orders` table. When a buyer calls `POST /purchase-orders/{id}/lock`, the service atomically checks and sets these columns inside a `BEGIN IMMEDIATE` transaction. Locks expire after 30 minutes. On read, if `locked_by` is set and `locked_at` is recent, the response includes `isLockedByOther: true` so the client renders read-only.

**Alternatives considered**:
- Optimistic locking (version column + CAS): Spec explicitly states "pessimistic locking — first buyer to open for edit gets exclusive access." Optimistic locking does not satisfy this requirement.
- Process-level mutex: Not safe with multiple Node.js instances and fails across restarts.

---

## Resolved NEEDS CLARIFICATION

All Technical Context unknowns from the plan template are now resolved:

| Unknown | Resolution |
|---------|-----------|
| HTTP framework | Fastify v5 ✅ |
| Schema / type system | TypeBox 0.34.x ✅ |
| Database ORM | Drizzle ORM 0.31.x + better-sqlite3 ✅ |
| Testing framework | Vitest 2.x ✅ |
| Notification queue | SQLite Outbox Pattern ✅ |
| Pessimistic locking | Application-level lock columns + BEGIN IMMEDIATE ✅ |
