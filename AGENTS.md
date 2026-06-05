# AppFoundry Agent Guide

## Communication

- User-facing replies should follow the active conversation language unless a
  task-specific instruction says otherwise.
- Keep public repository docs, code comments, identifiers, commit messages, and package names in English.
- Do not add consumer-specific product names to public APIs, docs, package
  names, or examples.

## Project Intent

AppFoundry is an open-source-ready toolkit for making AI-built apps production-safe without forcing a backend migration.

The first product wedge is:

> Self-hostable feedback, annotated screenshots, privacy-safe debug logs, and media upload safety for apps that already have a backend.

This repo is not a generic `utils` dump. Every module must have a clear user-facing capability, a stable public contract, and documented adapter boundaries.

## Current Scope

V0 includes:

- Feedback Kit
- Debug Kit
- Media Safety Kit
- Express/S3/Prisma-style adapters as examples, not mandatory core dependencies
- Swift packages for image, feedback, and upload primitives
- Agent-readable recipes for Codex/Cursor/Claude-style implementation workflows

V0 excludes:

- A full auth framework
- Contacts/friends/social graph
- A generic BaaS platform
- Analytics/session replay
- A hosted dashboard
- Consumer-specific business concepts

## Architecture Rules

- Core packages must be framework-agnostic.
- Backend core must not import Express, Prisma, or AWS SDK directly.
- Storage must target an `ObjectStore` interface. S3/R2/MinIO are adapters.
- Feedback must target repository/notifier/debug-log/storage interfaces.
- Redaction and privacy-safe defaults must be enabled by default.
- Examples may be opinionated; core APIs must stay portable.

## Development Workflow

- Prefer a sibling local dependency during early integration.
- Do not add AppFoundry as a submodule to consumer apps until V0 APIs are stable.
- Create feature branches per repo; do not edit multiple repos on `main`.
- Keep private implementation notes out of the public repository unless they
  are rewritten as reusable documentation.

## Quality Bar

- Contracts need tests before consumer apps adopt them.
- Public APIs need examples.
- Any module handling screenshots, images, logs, tokens, or user data needs privacy notes.
- Any migration recipe must include rollback and verification guidance.
