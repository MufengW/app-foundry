# @app-foundry/cli

Agent-oriented command scaffold for AppFoundry audits and adoption guidance.

The CLI is intentionally read-only by default. It does not rewrite app files,
run migrations, or assume a hosted service.

## Commands

```bash
npx app-foundry doctor
npx app-foundry audit-privacy --path .
npx app-foundry add feedback --dry-run
```

### `doctor`

Checks that the current repository has the expected AppFoundry V0 scaffold:
core docs, JavaScript packages, and the Swift package.

### `audit-privacy`

Scans source-like files for risky inline media, private keys, and obvious
secret assignments. Findings are warnings by default. Add `--fail-on-findings`
to make findings return a non-zero exit code.

### `add feedback --dry-run`

Prints a checklist for adopting feedback without changing files. Future
versions may add framework-specific generators behind explicit flags.
