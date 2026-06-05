# Consumer Integration Strategy

## Goal

Adopt AppFoundry incrementally in an existing app while preserving current
behavior and keeping rollback simple.

## Repository Layout

During early development, a consumer app can keep AppFoundry as a sibling
repository:

```text
workspace/
  app-foundry/
  consumer-app/
```

## Why Sibling Local Dependency First

Early AppFoundry APIs may change often. Sibling local dependencies reduce
friction while contracts stabilize.

Avoid submodules until:

- AppFoundry has release tags
- at least one module is adopted end-to-end
- tests exist for shared contracts
- package public APIs are stable enough to pin

## JavaScript Consumer Strategy

During local development:

```json
{
  "dependencies": {
    "@app-foundry/core": "file:../app-foundry/packages/js/core",
    "@app-foundry/debug": "file:../app-foundry/packages/js/debug",
    "@app-foundry/feedback": "file:../app-foundry/packages/js/feedback",
    "@app-foundry/media": "file:../app-foundry/packages/js/media"
  }
}
```

Local `file:` dependencies are a development-only adoption bridge. A hosted
build that checks out only the consumer app repository will not have the
sibling `app-foundry/` directory in its build context.

Do not deploy a consumer branch that depends on sibling `file:` paths until one
of these is true:

- AppFoundry packages are published and pinned by version.
- AppFoundry is vendored or otherwise included in the deployment build context
  by an explicit, reviewed packaging plan.
- The deploy target is configured to check out a workspace that includes both
  the consumer repo and `app-foundry/`.

After stabilization:

```json
{
  "dependencies": {
    "@app-foundry/core": "0.1.0",
    "@app-foundry/debug": "0.1.0",
    "@app-foundry/feedback": "0.1.0",
    "@app-foundry/media": "0.1.0"
  }
}
```

## Swift Consumer Strategy

During local development, add the local Swift package path from the consumer app's project configuration:

```text
../app-foundry/packages/swift
```

After stabilization, pin by Git URL and tag.

## First Adoption Slice

The first slice should be small and reversible:

1. Extract redaction into AppFoundry.
2. Add tests in AppFoundry.
3. Replace one consumer app redaction call site through an app-local wrapper.
4. Add focused tests in the consumer app.
5. Verify no behavior regression before expanding adoption.

Why redaction first:

- high safety value
- low UI risk
- easy to unit test
- clear improvement for bulk debug ingestion

## Second Adoption Slice

Object key and signed URL helpers.

Start with media surfaces that already store object keys or generate signed
URLs. Keep product-specific upload workflows in the consumer app until the
shared contract proves useful.

## Third Adoption Slice

Feedback contracts and storage-backed attachments.

Start by defining shared contracts before moving storage:

- preserve the consumer app's current feedback behavior
- add object-storage attachment support behind a reversible write path
- use `storeFeedbackAttachment` with an app-owned object-store adapter
- keep legacy read fallback during any screenshot migration

## Rollback Strategy

Every adoption step should be reversible:

- keep app-local wrappers around AppFoundry calls
- avoid changing database schema in the same commit as package adoption when possible
- keep legacy read fallback during storage migrations
- avoid deleting legacy code until tests and one release cycle pass

## Verification Matrix

AppFoundry:

- unit tests for extracted module
- package build/typecheck

Consumer app:

- focused backend tests
- no app-specific behavior regression
- iOS sideload only when iOS code changes
- deployment safety check when local `file:` dependencies are present

## Coordination

When using multiple implementation sessions:

- one coordinator owns contracts
- each repo gets its own feature branch
- private session notes stay private until they are rewritten as reusable public docs
- do not edit the same branch from two sessions
