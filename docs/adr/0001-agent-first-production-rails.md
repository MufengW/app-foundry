# ADR-0001: Agent-First Production Rails

## Status

Accepted.

## Context

AI coding tools make it easy to generate app code quickly. The resulting apps often work in demos but miss production details around uploads, feedback, logs, privacy, retention, and debugging context.

Traditional SDK docs assume a human developer will read concepts, choose APIs, and adapt them carefully. AI-built apps need more explicit recipes and guardrails.

## Decision

AppFoundry will be agent-first.

This means:

- recipes are first-class deliverables
- contracts are explicit and machine-readable where practical
- examples are small and copyable
- privacy and validation defaults are conservative
- future CLI commands should inspect existing apps and suggest fixes

## Consequences

Good:

- Easier for Codex/Cursor/Claude/Replit-style workflows to adopt.
- Better fit for the growing AI-built app market.
- Clearer public positioning than "common utils".

Tradeoffs:

- Docs must be more prescriptive.
- APIs must avoid clever magic.
- Examples and recipes need continuous maintenance.
