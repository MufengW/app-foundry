# ADR-0003: Local Sibling Dependency Before Submodule

## Status

Accepted.

## Context

AppFoundry will evolve while early consumer apps are still adopting it. Early
APIs will change frequently.

Git submodules pin a specific commit and require consumer repos to update the pointer each time AppFoundry changes. This adds friction during rapid extraction.

## Decision

During V0 extraction, AppFoundry should live as a sibling repository:

```text
workspace/
  app-foundry/
  consumer-app/
```

Consumer apps should use local path dependencies during active development.

Do not add AppFoundry as a submodule until:

- V0 APIs are stable
- feedback/debug/media contracts have tests
- at least one app has adopted a module end-to-end
- release tags exist

## Consequences

Good:

- Faster iteration.
- Cleaner AppFoundry history.
- Easier cross-repo coordination during active adoption.

Tradeoffs:

- Local setup is less reproducible until tags/packages exist.
- CI needs explicit checkout/install steps later.
- Consumers must not accidentally rely on uncommitted AppFoundry changes.
