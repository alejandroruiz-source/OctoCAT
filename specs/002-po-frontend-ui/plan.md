# Implementation Plan: Purchase Order Management Frontend

**Branch**: `002-po-frontend-ui` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-po-frontend-ui/spec.md`

## Summary

Build a role-aware single-page application (SPA) in React 19 + TypeScript that surfaces the existing Purchase Order Management REST API (spec 001) to three user roles: Buyer, Approver, and Supplier. The app authenticates via SSO/OIDC PKCE, routes users to role-specific views, and polls for status changes every 10 seconds to satisfy the 15-second visibility requirement. Tests follow TDD — component contracts written first with React Testing Library + MSW, integration flows validated with Playwright against a real in-memory Fastify backend.

## Technical Context

**Language/Version**: TypeScript 5.x (consistent with backend)

**Primary Dependencies**:
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `19.x` | UI framework |
| `react-dom` | `19.x` | DOM renderer |
| `react-router-dom` | `7.x` | Client-side routing |
| `@tanstack/react-query` | `5.x` | Server state management, background polling |
| `tailwindcss` | `4.x` | Utility-first styling |
| `oidc-client-ts` | `3.x` | OIDC PKCE flow, token management |
| `vite` | `6.x` | Build tool + dev server |
| `@vitejs/plugin-react` | `4.x` | React HMR plugin for Vite |
| `vitest` | `2.x` | Test runner (matches backend) |
| `@testing-library/react` | `16.x` | Component testing |
| `@testing-library/user-event` | `14.x` | User interaction simulation |
| `msw` | `2.x` | HTTP intercept layer for component tests |
| `@playwright/test` | `1.x` | End-to-end integration tests |

**Storage**: None (stateless SPA). Session token held in-memory via OIDC client. No localStorage for sensitive tokens.

**Testing**:
- `web/tests/contract/` — React Testing Library + MSW intercepts; written before components; must fail red first
- `web/tests/integration/` — Playwright e2e against real Fastify backend (in-memory SQLite, test auth mode)

**Target Platform**: Modern evergreen browsers (Chrome, Firefox, Edge, Safari current + prior major); minimum 768px viewport.

**Project Type**: Frontend SPA (`web/src/`). Consumes backend REST API; no additional server-side layer.

**Performance Goals**:
- SC-003: PO list page initial paint < 2 seconds for 200 items
- SC-006: Status updates visible within 15 seconds (TanStack Query `refetchInterval: 10_000`)
- SC-001: Buyer create+submit flow completable in < 5 minutes

**Constraints**:
- No authentication screen — SSO/OIDC PKCE redirects to IdP on unauthenticated load
- All money values displayed as dollars (divide cents by 100); transmitted as cents to API
- Read-only rendering for POs not in DRAFT or REVISION_REQUIRED status
- Lock conflict must show lock holder identity + expiry countdown (FR-012)
- No mock-only tests for flows that touch API data (Playwright tests use real backend)

**Scale/Scope**: Single-instance SPA. No SSR. No CDN configuration. Served as static assets from the same Node.js process or a simple static host.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|---------|
| I. Library-First Architecture | ✅ PASS | API client (`web/src/api/`) is independently testable; UI components (`web/src/components/`) are independently testable without pages; pages compose these pieces |
| II. Test-Driven Development | ✅ PASS | Contract tests (RTL + MSW) written before any component code; must fail initially; Playwright flows written before page implementations |
| III. Integration Tests over Mocks | ✅ PASS | Playwright integration tests run against real Fastify backend with in-memory SQLite and test-auth mode — no database mocking. MSW in component tests intercepts HTTP (not SQLite), which is acceptable for view-layer contracts |
| IV. Simplicity over Abstraction | ✅ PASS | TanStack Query for server state (no Redux/Zustand), React Context for auth, React Router v7 for routing — no custom state machines or middleware chains |
| V. REST API with OpenAPI Standards | ✅ PASS | Frontend strictly consumes the documented backend API from spec 001; no additional API layer introduced; typed API client functions match OpenAPI contract shapes |

**No constitution violations. Complexity Tracking table not required.**

## Project Structure

### Documentation (this feature)

```text
specs/002-po-frontend-ui/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output (/speckit-plan)
├── data-model.md        # Phase 1 output (/speckit-plan)
├── quickstart.md        # Phase 1 output (/speckit-plan)
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — component prop contracts
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
web/                             # Frontend SPA (standalone project)
├── src/
│   ├── api/
│   │   ├── client.ts            # Base fetch wrapper: auth headers, error normalization
│   │   ├── purchaseOrders.ts    # Typed wrappers for PO endpoints
│   │   ├── lineItems.ts         # Typed wrappers for line item endpoints
│   │   ├── approvals.ts         # Typed wrappers for approval endpoints
│   │   └── types.ts             # Re-exports shared types from ../src/lib/models/
│   ├── auth/
│   │   ├── AuthProvider.tsx     # OIDC UserManager, session check, redirect logic
│   │   └── useAuth.ts           # Hook: { user, token, logout, isLoading }
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx        # Colored status badge
│   │   │   ├── Table.tsx        # Sortable/paginatable table
│   │   │   ├── Modal.tsx        # Confirm/form modal
│   │   │   └── ErrorBanner.tsx  # API error display
│   │   └── po/
│   │       ├── POStatusBadge.tsx    # Status → color + label
│   │       ├── LineItemRow.tsx      # Single line item (view or edit mode)
│   │       ├── LineItemEditor.tsx   # Add/edit form for a line item
│   │       ├── StatusHistory.tsx    # Timeline of status transitions
│   │       └── LockWarning.tsx      # Lock holder + expiry countdown
│   ├── pages/
│   │   ├── buyer/
│   │   │   ├── POListPage.tsx       # PO list + status filter + pagination
│   │   │   ├── POCreatePage.tsx     # New PO form (supplier, branch, notes)
│   │   │   ├── PODetailPage.tsx     # View/edit draft or revision-required PO
│   │   │   └── POSubmitPage.tsx     # Delivery date entry + approval threshold notice
│   │   ├── approver/
│   │   │   ├── ApprovalQueuePage.tsx    # All AWAITING_APPROVAL POs, overdue highlight
│   │   │   └── ApprovalDetailPage.tsx   # Review page + approve/reject actions
│   │   └── supplier/
│   │       ├── SupplierPOListPage.tsx   # Supplier's non-draft POs
│   │       └── SupplierPODetailPage.tsx # View + Fulfill action
│   ├── hooks/
│   │   ├── usePurchaseOrders.ts  # TanStack Query hooks (list, getById, mutations)
│   │   ├── useLineItems.ts       # TanStack Query mutations for line items
│   │   └── useApprovals.ts       # TanStack Query mutations for approvals
│   ├── lib/
│   │   ├── formatters.ts         # centsToDisplay(), formatDate(), relativeTime()
│   │   └── constants.ts          # APPROVAL_THRESHOLD_CENTS = 1_000_000
│   ├── router.tsx                # React Router v7 route tree
│   └── main.tsx                  # Root: QueryClientProvider, AuthProvider, RouterProvider
├── tests/
│   ├── contract/                 # RTL + MSW — written before components
│   │   ├── POListPage.contract.test.tsx
│   │   ├── PODetailPage.contract.test.tsx
│   │   ├── ApprovalQueuePage.contract.test.tsx
│   │   └── SupplierPOListPage.contract.test.tsx
│   ├── integration/              # Playwright e2e against real backend
│   │   ├── buyer.flow.test.ts    # Create → add items → submit
│   │   ├── approver.flow.test.ts # View queue → approve/reject
│   │   └── supplier.flow.test.ts # View POs → fulfill
│   └── setup.ts                  # MSW server start/reset/stop lifecycle
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── playwright.config.ts
└── package.json

src/                             # Backend (existing — no changes)
tests/                           # Backend tests (existing — no changes)
```

**Structure Decision**: `web/` is a self-contained Vite+React project with its own `package.json`. TypeScript path aliases in `web/tsconfig.json` point `~backend/*` to `../src/lib/models/*` so backend TypeBox-inferred types are shared without duplication. The root `package.json` gains convenience scripts (`web:dev`, `web:test`, `web:build`).

## Complexity Tracking

> No constitution violations — this section is not required.
