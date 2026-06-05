# ADR-0002: Adapter-First Architecture

## Status

Accepted.

## Context

Existing apps often already have a backend, database, storage provider, auth model, and admin workflow. Requiring migration to one platform would make AppFoundry less useful.

Consumer apps often use custom backend infrastructure, but their
implementation details differ. A reusable project must extract contracts, not
copy app-specific controllers directly.

## Decision

AppFoundry core packages will be adapter-first.

Core packages define interfaces and policies. Adapter packages integrate with frameworks/providers.

Core must not directly depend on:

- Express
- Prisma
- AWS SDK
- R2-specific environment variables
- app-specific Prisma schemas
- app-specific auth/session services

Adapter packages may depend on those tools.

## Consequences

Good:

- Portable to more stacks.
- Better open-source compatibility.
- Consumer apps can adopt gradually.

Tradeoffs:

- More interfaces to design.
- More test fixtures needed.
- Initial implementation is slower than copying controllers.
