# Research: Purchase Order Management Frontend

**Branch**: `002-po-frontend-ui` | **Date**: 2026-06-10

## Decision Log

### R-001: UI Framework — React 19

**Decision**: React 19 + TypeScript 5.x

**Rationale**:
- The existing backend already mandates TypeScript (constitution). React is the dominant SPA framework with the deepest TypeScript ecosystem.
- React 19's concurrent features (automatic batching, Suspense for data fetching) reduce boilerplate for loading states, which appear throughout the PO management flows.
- Consistent with TypeScript across the full stack reduces cognitive switching for developers.

**Alternatives Considered**:
- *Vue 3*: Excellent TypeScript support, but smaller enterprise ecosystem than React. Less alignment with existing team patterns implied by the TypeScript-first constitution.
- *Angular*: Built-in opinionated structure and TypeScript-first, but higher framework overhead and steeper learning curve; violates Simplicity principle.
- *Svelte/SvelteKit*: Excellent performance, but smaller ecosystem and less mature TypeScript tooling for component testing.

---

### R-002: Build Tool — Vite 6

**Decision**: Vite 6 with `@vitejs/plugin-react`

**Rationale**:
- Sub-second HMR for fast development iteration on component work.
- Native TypeScript support without additional configuration.
- Standard for React+TypeScript projects as of 2025; replaces CRA.
- Path aliases (`~backend/`) configured in `vite.config.ts` and `tsconfig.json` for type sharing.

**Alternatives Considered**:
- *Webpack 5*: More configuration overhead, slower dev server. No meaningful benefit over Vite for this project size.
- *esbuild only*: No HMR, no plugin ecosystem. Missing React Fast Refresh.

---

### R-003: Server State Management — TanStack Query v5

**Decision**: TanStack Query v5 (`@tanstack/react-query`)

**Rationale**:
- SC-006 requires status updates visible within 15 seconds. TanStack Query's `refetchInterval: 10_000` satisfies this without manual polling logic.
- Handles loading/error/stale states across all API calls, reducing boilerplate in every component.
- Built-in pagination support for PO list (SC-003).
- Background refetch on window focus keeps the approval queue current for approvers.
- No separate global state library needed — server state *is* the application state.

**Alternatives Considered**:
- *SWR*: Simpler API, but weaker mutation/optimistic update support. TanStack Query's devtools are superior for debugging cache state.
- *Redux Toolkit Query*: Heavier setup, requires Redux infrastructure. Violates Simplicity principle for a project that needs no client-side global state beyond auth.
- *Manual `useEffect` + fetch*: Workable for simple cases but does not handle cache invalidation, deduplication, or background polling gracefully. High boilerplate risk.

---

### R-004: Routing — React Router v7

**Decision**: React Router v7 (declarative mode, not file-based)

**Rationale**:
- Industry standard; well-known by any React developer.
- Typed params with TypeScript support in v7.
- Nested layouts enable shared chrome (navbar, role-based nav) without repetition.
- Declarative route definitions in a single `router.tsx` file keeps routing visible and auditable.

**Alternatives Considered**:
- *TanStack Router*: Fully type-safe routing, but newer and less widely adopted. React Router v7 is sufficient for this project's route count (~8 routes).
- *Next.js file-based routing*: Would require migrating to a full Next.js setup; SSR is not needed (internal tool, auth-gated).

---

### R-005: Styling — Tailwind CSS v4

**Decision**: Tailwind CSS v4

**Rationale**:
- Zero-runtime styling; Tailwind classes compile to a minimal CSS bundle.
- No design system dependency or component library needed — this is an internal enterprise tool.
- Responsive utilities satisfy the 768px minimum viewport requirement (SC-005) with a single `md:` prefix.
- Coloring status badges (DRAFT=gray, AWAITING_APPROVAL=amber, APPROVED=green, etc.) is trivial with conditional class lists.
- Tailwind v4's CSS-first config is simpler than v3's JS config.

**Alternatives Considered**:
- *shadcn/ui + Radix*: Pre-built accessible components, but adds a heavyweight dependency tree for an internal tool. Accessibility requirements are standard (no WCAG AAA mandate).
- *MUI / Ant Design*: Feature-complete but opinionated; overrides and theme customization create complexity over time. Violates Simplicity principle.
- *CSS Modules*: More verbose than Tailwind for the density of conditional styling needed (status badges, lock warnings, overdue highlights).

---

### R-006: Authentication — OIDC PKCE via `oidc-client-ts`

**Decision**: `oidc-client-ts` v3 for OIDC Authorization Code + PKCE flow

**Rationale**:
- The spec mandates SSO — users arrive pre-authenticated via an IdP. PKCE is the recommended OAuth2 flow for SPAs (no client secret required, CSRF-safe).
- `oidc-client-ts` is framework-agnostic, well-maintained, and works with any OIDC-compliant IdP (Okta, Auth0, Azure AD, Keycloak).
- Token stored in-memory (not localStorage) to prevent XSS token theft.
- Silent renew via hidden iframe refreshes tokens without user interruption.
- For tests, the backend's test auth mode (`x-test-user-id` / `x-test-user-role` headers) bypasses OIDC entirely; no IdP required in CI.

**Alternatives Considered**:
- *`@auth0/auth0-react`*: Excellent DX but Auth0-specific. Using `oidc-client-ts` keeps the choice of IdP open.
- *`next-auth`*: Requires Next.js server context.
- *Manual JWT validation*: Reinventing PKCE is a security risk.

**Token storage decision**: In-memory (JavaScript variable + `sessionStorage` for silent renew state). Tradeoff: token lost on tab close (user re-authenticates). Acceptable for an enterprise internal tool where sessions are short-lived anyway.

---

### R-007: Testing — Vitest + RTL + MSW + Playwright

**Decision**: Three-layer test strategy

**Rationale**:

| Layer | Tool | What it tests |
|-------|------|---------------|
| Component contracts | Vitest + RTL + MSW v2 | Component prop/event contracts; rendering behavior; form validation; user interaction |
| Integration (e2e) | Playwright v1 | Full user flows in a real browser against a real Fastify backend + in-memory SQLite |

- Vitest is already used by the backend; consistent tooling across the repo.
- RTL encourages testing from the user's perspective (queries by role/label), not implementation details.
- MSW v2 intercepts `fetch` at the service worker or Node level — components see realistic JSON responses without the backend running. This satisfies TDD (write MSW handlers to define expected API shape, then implement the component).
- Playwright covers the full flow in a real browser. Constitution Principle III requires real backend for integration: Playwright tests start a Fastify server with `createDb(':memory:')` and test-auth headers, then run scenarios in Chromium.

**Constitution III alignment for frontend**: The constitution targets "data-layer validation." The frontend has no data layer. MSW intercepts HTTP (not SQLite), so MSW-based tests are view-layer contracts, not data-layer tests. The Playwright suite is the integration layer that tests against real SQLite — fully compliant.

---

### R-008: Type Sharing — Path Aliases

**Decision**: TypeScript path aliases in `web/tsconfig.json`: `~backend/*` → `../src/lib/models/*`

**Rationale**:
- Backend TypeBox schemas (`PurchaseOrderResponse`, `LineItemResponse`, etc.) already export TypeScript types via `Static<typeof Schema>`.
- Re-using these types in the frontend eliminates drift between what the API returns and what the frontend renders.
- Path alias avoids deep `../../../../src/lib/models/...` import chains.
- No npm workspaces or separate package publishing needed — same repo, same TypeScript project.

**Alternatives Considered**:
- *Generate OpenAPI client*: `openapi-typescript` or `orval` could generate typed client from the Swagger doc. Extra build step, generated code is harder to debug. Direct type import is simpler.
- *npm workspace / package publishing*: Correct for a large monorepo with many consumers, but over-engineered for a two-project repo. Violates Simplicity principle.
- *Copy-paste types*: Creates two sources of truth. Rejected.

---

### R-009: Currency Display

**Decision**: `Intl.NumberFormat` for display; all API values in integer cents

**Rationale**:
- Backend stores and transmits money as integer cents (no floating-point). The frontend converts `cents / 100` to dollars only for display.
- `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` handles locale-correct display without a library.
- The $10,000 approval threshold is `APPROVAL_THRESHOLD_CENTS = 1_000_000` in `web/src/lib/constants.ts`.

---

### R-010: Polling Strategy for SC-006

**Decision**: TanStack Query `refetchInterval: 10_000` on PO detail and approval queue queries

**Rationale**:
- SC-006: "updated status visible within 15 seconds without manual reload." 10-second refetch interval satisfies this with 5 seconds of margin.
- TanStack Query's `staleTime: 0` ensures every interval triggers a real request.
- Only active queries poll — a background tab does not generate traffic (TanStack Query pauses polling on `visibilitychange`).
- No WebSocket or Server-Sent Events needed for this cadence.

**Alternatives Considered**:
- *WebSockets*: Real-time but requires backend changes and connection management. Over-engineered for 15-second SLA.
- *Server-Sent Events*: Unidirectional push; requires backend endpoint additions. Same conclusion as WebSockets.
- *5-second interval*: Satisfies the SLA with more margin but triples API traffic. 10 seconds is a better balance.
