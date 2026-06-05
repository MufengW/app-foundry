import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  auditPrivacy,
  doctorProject,
  feedbackDryRunChecklist,
  runAppFoundryCli,
} from "../src/index.js";

describe("doctorProject", () => {
  it("checks the AppFoundry V0 scaffold", async () => {
    const root = await tempDir();
    await scaffoldDoctorFixture(root);

    const result = await doctorProject({ root });

    assert.equal(result.ok, true);
    assert.equal(result.checks.every((check) => check.ok), true);
  });

  it("reports missing required paths", async () => {
    const root = await tempDir();
    await writeFile(path.join(root, "package.json"), JSON.stringify({ workspaces: ["packages/js/*"] }));

    const result = await doctorProject({ root });

    assert.equal(result.ok, false);
    assert.equal(result.checks.some((check) => check.code === "path:README.md" && !check.ok), true);
  });
});

describe("auditPrivacy", () => {
  it("finds inline base64 media and private keys without scanning ignored dirs", async () => {
    const root = await tempDir();
    await writeFile(
      path.join(root, "upload.js"),
      "const screenshotBase64 = 'data:image/png;base64,abcdef';\n"
    );
    await mkdir(path.join(root, "node_modules"), { recursive: true });
    await writeFile(path.join(root, "node_modules", "ignored.js"), "const password = 'reallysecretvalue123';\n");
    await writeFile(path.join(root, "key.txt"), "-----BEGIN PRIVATE KEY-----\nredacted\n");

    const result = await auditPrivacy({ root });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.findings.map((finding) => finding.code).sort(),
      ["inline_base64_media", "private_key_literal", "raw_media_base64_field"]
    );
  });

  it("returns ok for safe source files", async () => {
    const root = await tempDir();
    await writeFile(path.join(root, "safe.js"), "export const storageKey = 'feedback/report/screenshot.png';\n");

    const result = await auditPrivacy({ root });

    assert.equal(result.ok, true);
    assert.equal(result.findings.length, 0);
  });
});

describe("runAppFoundryCli", () => {
  it("prints JSON doctor output", async () => {
    const root = await tempDir();
    await scaffoldDoctorFixture(root);
    const stdout = createWriter();
    const stderr = createWriter();

    const exitCode = await runAppFoundryCli(["doctor", "--path", root, "--json"], { stdout, stderr });

    assert.equal(exitCode, 0);
    assert.equal(JSON.parse(stdout.output()).ok, true);
    assert.equal(stderr.output(), "");
  });

  it("keeps privacy audit warnings non-fatal unless requested", async () => {
    const root = await tempDir();
    await writeFile(path.join(root, "upload.js"), "const photoBase64 = 'abc';\n");
    const stdout = createWriter();
    const stderr = createWriter();

    const defaultExit = await runAppFoundryCli(["audit-privacy", "--path", root], { stdout, stderr });
    const strictExit = await runAppFoundryCli(["audit-privacy", "--path", root, "--fail-on-findings"], {
      stdout,
      stderr,
    });

    assert.equal(defaultExit, 0);
    assert.equal(strictExit, 1);
  });

  it("requires dry-run for add feedback", async () => {
    const stdout = createWriter();
    const stderr = createWriter();

    assert.equal(await runAppFoundryCli(["add", "feedback"], { stdout, stderr }), 2);
    assert.equal(await runAppFoundryCli(["add", "feedback", "--dry-run"], { stdout, stderr }), 0);
    assert.equal(feedbackDryRunChecklist().some((item) => item.includes("backup and restore drill")), true);
  });
});

async function scaffoldDoctorFixture(root) {
  const paths = [
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
  for (const relativePath of paths) {
    await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
    await writeFile(path.join(root, relativePath), "ok\n");
  }
  await writeFile(path.join(root, "package.json"), JSON.stringify({ workspaces: ["packages/js/*"] }));
}

function createWriter() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
    },
    output() {
      return value;
    },
  };
}

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), "app-foundry-cli-"));
}
