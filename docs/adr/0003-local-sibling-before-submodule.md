# ADR-0003: Local Sibling Dependency Before Pinned Consumer Checkout

## Status

Amended.

## Context

AppFoundry will evolve while early consumer apps are still adopting it. Early
APIs will change frequently.

Git submodules pin a specific commit and require consumer repos to update the
pointer each time AppFoundry changes. This adds friction during rapid
extraction, but it can be useful before package publication when a consumer app
needs reproducible CI or deployment.

## Decision

During early V0 extraction, AppFoundry should live as a sibling repository:

```text
workspace/
  app-foundry/
  consumer-app/
```

Consumer apps should use local path dependencies during active development.

Avoid repo-local submodules until the adopted surface is test-backed:

- feedback/debug/media contracts have tests
- at least one app has adopted a module end-to-end
- the consumer needs a reproducible build context before package publication

When those conditions are met, a pinned `app-foundry/` submodule is acceptable.
The consumer repo must commit pointer updates with related app changes and run
focused tests against the exact pinned revision.

## Consequences

Good:

- Faster iteration.
- Cleaner AppFoundry history.
- Easier cross-repo coordination during active adoption.
- Reproducible pre-publication deploys when a consumer pins a reviewed
  submodule revision.

Tradeoffs:

- Local setup is less reproducible until tags/packages exist.
- CI needs explicit checkout/install steps later.
- Consumers must not accidentally rely on uncommitted AppFoundry changes.
- Submodule pointer drift needs routine review, just like a package upgrade.
