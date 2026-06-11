# OctoCAT Supply Chain Constitution

## Core Principles

### I. Library-First Architecture
Every feature must be designed as a self-contained, reusable library with clear separation of concerns. Libraries must be independently testable, comprehensively documented, and have a well-defined API contract. This maximizes code reusability and enables teams to compose functionality with confidence.

### II. Test-Driven Development (Non-Negotiable)
TDD is mandatory for all feature development: tests must be written first, approved by stakeholders, and initially fail before implementation begins. The Red-Green-Refactor cycle is strictly enforced. Contract tests must be written before any implementation to establish API expectations and ensure contracts are honored.

### III. Integration Tests Over Mocks
Integration testing using real SQLite databases is required for data-layer validation. Mock-based testing is insufficient for supply chain operations where data consistency is critical. Real database interactions reveal integration issues that mocks cannot surface.

### IV. Simplicity Over Abstraction
Prefer direct framework usage over unnecessary abstraction layers. Use TypeScript and framework APIs as they are intended. Avoid creating custom abstractions that add complexity without clear benefit. Code clarity and maintainability take precedence over theoretical elegance.

### V. REST API with OpenAPI Standards
All services expose functionality through well-designed REST APIs documented with OpenAPI/Swagger specifications. This ensures machine-readable contracts, consistency across services, and enables API-first development workflows.

## Technology Stack

- **Language**: TypeScript for type safety and developer confidence
- **API Style**: RESTful with OpenAPI/Swagger documentation
- **Testing**: Contract tests (before implementation), integration tests with real SQLite
- **Framework Integration**: Direct use of established frameworks; minimize custom middleware

## Dependency Management

Dependencies must be deliberately chosen and regularly evaluated. Before adding any external dependency:
1. Confirm it solves a real problem that cannot be efficiently solved with existing dependencies
2. Evaluate maintenance status, community support, and security record
3. Document the justification in commit messages and architecture decisions
4. Periodically audit dependencies to remove unused ones

Maintain a minimal, focused set of dependencies to reduce attack surface and cognitive load.

## Governance

This constitution supersedes all other development guidelines. All pull requests and code reviews MUST verify compliance with these principles. Deviations require explicit documentation and exception approval from the team lead.

Amendments to this constitution require documentation of the rationale, stakeholder review, and migration planning for affected code and tests. Version numbering follows semantic versioning:
- MAJOR: Backward-incompatible principle removals or fundamental redefinitions
- MINOR: New principles or significant expansions to existing guidance
- PATCH: Clarifications, wording refinements, or non-semantic improvements

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
