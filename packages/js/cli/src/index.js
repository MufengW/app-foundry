import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export const CLI_VERSION = "0.0.0";

const DOCTOR_REQUIRED_PATHS = [
  "README.md",
  "docs/RFC-0001-appfoundry-v0.md",
  "docs/roadmap.md",
  "docs/contracts/debug-event.md",
  "docs/contracts/feedback.md",
  "docs/contracts/media-object.md",
  "packages/js/core/package.json",
  "packages/js/debug/package.json",
  "packages/js/feedback/package.json",
  "packages/js/media/package.json",
  "packages/js/storage-s3/package.json",
  "packages/swift/Package.swift",
];

const AUDIT_EXCLUDED_DIRS = new Set([
  ".build",
  ".git",
  ".swiftpm",
  "DerivedData",
  "build",
  "builds",
  "coverage",
  "dist",
  "node_modules",
]);

const AUDIT_TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".kts",
  ".md",
  ".mjs",
  ".plist",
  ".py",
  ".sh",
  ".swift",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const AUDIT_PATTERNS = [
  {
    code: "inline_base64_media",
    severity: "high",
    pattern: /data:(?:image|audio|video)\/[a-z0-9.+-]+;base64,/i,
    message: "Inline base64 media can leak private screenshots or uploads into source or logs.",
  },
  {
    code: "raw_media_base64_field",
    severity: "medium",
    pattern: /\b(?:screenshot|image|photo|avatar|audio|video)(?:Base64|_base64|Data)\b/,
    message: "Raw media/base64 field names should be redacted or moved to object storage.",
  },
  {
    code: "private_key_literal",
    severity: "critical",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    message: "Private key material should never be committed.",
  },
  {
    code: "secret_assignment",
    severity: "high",
    pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
    message: "Potential secret assignment found.",
  },
];

export async function doctorProject(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const checks = [];

  for (const relativePath of DOCTOR_REQUIRED_PATHS) {
    checks.push({
      code: `path:${relativePath}`,
      ok: await pathExists(path.join(root, relativePath)),
      message: relativePath,
    });
  }

  const packageJson = await readJsonIfExists(path.join(root, "package.json"));
  const workspaces = Array.isArray(packageJson?.workspaces) ? packageJson.workspaces : [];
  checks.push({
    code: "workspace:packages/js/*",
    ok: workspaces.includes("packages/js/*"),
    message: "Root package.json includes packages/js/* workspace.",
  });

  return {
    ok: checks.every((check) => check.ok),
    root,
    checks,
  };
}

export async function auditPrivacy(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const files = await collectAuditFiles(root);
  const findings = [];

  for (const filePath of files) {
    const text = await readTextFile(filePath, options.maxFileBytes ?? 1024 * 1024);
    if (text == null) continue;

    for (const rule of AUDIT_PATTERNS) {
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (!rule.pattern.test(lines[index])) continue;
        findings.push({
          code: rule.code,
          severity: rule.severity,
          message: rule.message,
          path: path.relative(root, filePath),
          line: index + 1,
        });
      }
    }
  }

  return {
    ok: findings.length === 0,
    root,
    scannedFiles: files.length,
    findings,
  };
}

export function feedbackDryRunChecklist() {
  return [
    "Add @app-foundry/debug, @app-foundry/media, and @app-foundry/feedback through a local or pinned dependency.",
    "Create app-owned repository, notifier, debug snapshot, and object-store adapters.",
    "Store screenshots as object keys, not inline base64, with legacy read fallback if migration is required.",
    "Validate media bytes before storage and before AI/provider calls.",
    "Add focused tests for create, list, seen, resolve, signed URL access, and redacted debug snapshots.",
    "Run a backup and restore drill before any schema migration, backfill, or legacy data rewrite.",
  ];
}

export async function runAppFoundryCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  const command = argv[0];

  if (!command || command === "--help" || command === "-h") {
    stdout.write(helpText());
    return 0;
  }

  if (command === "--version" || command === "-v") {
    stdout.write(`${CLI_VERSION}\n`);
    return 0;
  }

  if (command === "doctor") {
    const options = parseOptions(argv.slice(1));
    const result = await doctorProject({ root: options.path ?? cwd });
    stdout.write(formatDoctor(result, options.json));
    return result.ok ? 0 : 1;
  }

  if (command === "audit-privacy") {
    const options = parseOptions(argv.slice(1));
    const result = await auditPrivacy({ root: options.path ?? cwd });
    stdout.write(formatPrivacyAudit(result, options.json));
    return !result.ok && options.failOnFindings ? 1 : 0;
  }

  if (command === "add" && argv[1] === "feedback") {
    const options = parseOptions(argv.slice(2));
    if (!options.dryRun) {
      stderr.write("app-foundry add feedback is scaffold-only in V0. Re-run with --dry-run.\n");
      return 2;
    }
    stdout.write(formatFeedbackDryRun());
    return 0;
  }

  stderr.write(`Unknown command: ${argv.join(" ")}\n\n`);
  stderr.write(helpText());
  return 2;
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--fail-on-findings") options.failOnFindings = true;
    else if (arg === "--path") {
      options.path = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--path=")) {
      options.path = arg.slice("--path=".length);
    }
  }
  return options;
}

function formatDoctor(result, asJson) {
  if (asJson) return `${JSON.stringify(result, null, 2)}\n`;
  const lines = [`AppFoundry doctor: ${result.ok ? "ok" : "failed"}`];
  for (const check of result.checks) {
    lines.push(`${check.ok ? "ok" : "missing"} ${check.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatPrivacyAudit(result, asJson) {
  if (asJson) return `${JSON.stringify(result, null, 2)}\n`;
  const lines = [`AppFoundry privacy audit: ${result.findings.length} finding(s), ${result.scannedFiles} file(s) scanned`];
  for (const finding of result.findings) {
    lines.push(`${finding.severity} ${finding.code} ${finding.path}:${finding.line} ${finding.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatFeedbackDryRun() {
  return `AppFoundry feedback adoption dry run:\n${feedbackDryRunChecklist()
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n")}\n`;
}

function helpText() {
  return `Usage: app-foundry <command>

Commands:
  doctor                         Check the AppFoundry V0 scaffold.
  audit-privacy [--path dir]     Scan for privacy-risky source patterns.
  add feedback --dry-run         Print a feedback adoption checklist.

Options:
  --json                         Print JSON output where supported.
  --path <dir>                   Use a directory other than the current working directory.
  --fail-on-findings             Make audit-privacy return non-zero when findings exist.
`;
}

async function collectAuditFiles(root) {
  const files = [];
  await walk(root, files);
  return files;
}

async function walk(directory, files) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!AUDIT_EXCLUDED_DIRS.has(entry.name)) await walk(fullPath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldAuditFile(fullPath)) files.push(fullPath);
  }
}

function shouldAuditFile(filePath) {
  const extension = path.extname(filePath);
  if (AUDIT_TEXT_EXTENSIONS.has(extension)) return true;
  return path.basename(filePath).startsWith(".env");
}

async function readTextFile(filePath, maxBytes) {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return null;
  }
  if (stat.size > maxBytes) return null;
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
