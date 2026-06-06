import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import {
  DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES,
  FEEDBACK_ATTACHMENT_STATUS_ERRORS,
  DEFAULT_STRUCTURED_FEEDBACK_HEADINGS,
  STRUCTURED_FEEDBACK_FIELDS,
  buildStructuredFeedbackContent,
  createFeedbackService,
  normalizeCreateFeedbackInput,
  normalizeFeedbackAttachment,
  normalizeFeedbackAttachmentStatus,
  normalizeFeedbackAttachmentStatusError,
  normalizeStructuredFeedbackInput,
  normalizeFeedbackType,
  storeFeedbackAttachment,
} from "../src/index.js";

const RAW_B64 = Buffer.from("feedback screenshot bytes").toString("base64");
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const require = createRequire(import.meta.url);

function createRepository() {
  const calls = {
    create: [],
    listForUser: [],
    listForAdmin: [],
    markSeen: [],
    markSeenMany: [],
    resolve: [],
    resolveMany: [],
    userResolve: [],
    markUserNotified: [],
  };
  return {
    calls,
    repository: {
      async create(input) {
        calls.create.push(input);
        return {
          id: "fb_1",
          status: "open",
          ...input,
          updatedAt: input.createdAt,
        };
      },
      async listForUser(query) {
        calls.listForUser.push(query);
        return [];
      },
      async listForAdmin(query) {
        calls.listForAdmin.push(query);
        return { items: [], nextCursor: null };
      },
      async markSeen(input) {
        calls.markSeen.push(input);
      },
      async markSeenMany(input) {
        calls.markSeenMany.push(input);
        return { count: input.all ? 12 : input.ids.length };
      },
      async resolve(input) {
        calls.resolve.push(input);
        return { id: input.id, type: "bug", content: "fixed", status: "resolved" };
      },
      async resolveMany(input) {
        calls.resolveMany.push(input);
        return { count: input.ids.length };
      },
      async userResolve(input) {
        calls.userResolve.push(input);
        return {
          id: input.id,
          userId: input.userId,
          type: "bug",
          content: "fixed",
          status: input.resolved ? "user_resolved" : "open",
          userResolvedAt: input.userResolvedAt,
          userNote: input.userNote,
        };
      },
      async markUserNotified(input) {
        calls.markUserNotified.push(input);
        return {
          id: input.id,
          userId: "user_1",
          type: "bug",
          content: "fixed",
          status: "notified",
          notifiedAt: input.notifiedAt,
          notifiedBy: input.notifiedBy,
        };
      },
    },
  };
}

describe("createFeedbackService", () => {
  it("creates feedback records with object-key attachments and redacted debug snapshots", async () => {
    const { repository, calls } = createRepository();
    const notifierCalls = [];
    const service = createFeedbackService({
      repository,
      debugLogRepository: {
        async findSnapshot(query) {
          assert.equal(query.userId, "user_1");
          assert.equal(query.scopes[0], "api.feedback");
          return [
            {
              source: "ios",
              eventType: "feedback_submit",
              debugPrefix: "api.feedback",
              payload: {
                screenshotBase64: RAW_B64,
                accessToken: "secret-token",
              },
              occurredAt: "2026-06-05T00:55:00.000Z",
            },
          ];
        },
      },
      notifier: {
        feedbackCreated(record) {
          notifierCalls.push(record.id);
        },
      },
      clock: () => new Date("2026-06-05T01:00:00.000Z"),
    });

    const result = await service.create({
      userId: "user_1",
      type: "BUG",
      content: "  Screenshot upload leaked raw bytes.  ",
      context: {
        platform: "ios",
        authorization: "Bearer secret",
      },
      attachments: [
        {
          kind: "screenshot",
          storageKey: "feedback/project-1/fb_1/shot.jpg",
          contentType: "image/jpeg",
          byteSize: 100,
        },
      ],
      attachDebugLogs: true,
      debugLogScopes: ["api.feedback"],
    });

    assert.equal(result.feedback.id, "fb_1");
    assert.equal(calls.create[0].type, "bug");
    assert.equal(calls.create[0].content, "Screenshot upload leaked raw bytes.");
    assert.deepEqual(calls.create[0].context.authorization, { __redacted: "secret" });
    assert.equal(calls.create[0].attachments[0].storageKey, "feedback/project-1/fb_1/shot.jpg");
    assert.equal(result.debugSnapshot.eventCount, 1);
    assert.equal(result.debugSnapshot.events[0].payload.screenshotBase64.__redacted, "base64");
    assert.equal(result.debugSnapshot.events[0].payload.accessToken.__redacted, "secret");
    assert.doesNotMatch(JSON.stringify(result), new RegExp(RAW_B64));
    assert.deepEqual(notifierCalls, ["fb_1"]);
  });

  it("returns an explicit missing-debug-repository snapshot marker", async () => {
    const { repository } = createRepository();
    const service = createFeedbackService({
      repository,
      clock: () => new Date("2026-06-05T01:00:00.000Z"),
    });

    const result = await service.create({
      type: "other",
      content: "Please look at this",
      attachDebugLogs: true,
    });

    assert.deepEqual(result.debugSnapshot, {
      attached: false,
      eventCount: 0,
      reason: "debug_log_repository_missing",
      scopes: [],
    });
  });

  it("creates feedback from structured content entries", async () => {
    const { repository, calls } = createRepository();
    const service = createFeedbackService({
      repository,
      clock: () => new Date("2026-06-05T01:00:00.000Z"),
    });

    const result = await service.create({
      type: "BUG",
      structuredContent: {
        observedBehavior: "The feedback sheet closed after adding a screenshot.",
        expectedBehavior: "The draft should stay open.",
        suspectedCause: "The sheet state is not persisted.",
      },
      structuredContentOptions: {
        headings: {
          observedBehavior: "Observed",
          expectedBehavior: "Expected",
          suspectedCause: "Suspected cause",
        },
      },
    });

    assert.equal(result.feedback.content, [
      "Observed",
      "The feedback sheet closed after adding a screenshot.",
      "",
      "Expected",
      "The draft should stay open.",
      "",
      "Suspected cause",
      "The sheet state is not persisted.",
    ].join("\n"));
    assert.equal(calls.create[0].content, result.feedback.content);
  });

  it("passes through list, seen, and resolve lifecycle calls", async () => {
    const { repository, calls } = createRepository();
    const userResolveNotifications = [];
    const userNotifiedNotifications = [];
    const service = createFeedbackService({
      repository,
      notifier: {
        feedbackUserResolved(record) {
          userResolveNotifications.push(record.id);
        },
        feedbackUserNotified(record) {
          userNotifiedNotifications.push(record.id);
        },
      },
      clock: () => new Date("2026-06-05T01:00:00.000Z"),
    });

    await service.listForUser({ userId: "user_1", limit: 999 });
    await service.listForAdmin({
      type: "FEATURE",
      changedSince: new Date("2026-06-04T00:00:00.000Z"),
      createdSince: "2026-06-03T00:00:00.000Z",
      resolved: false,
      seen: true,
      limit: 999,
    });
    await service.markSeen({ id: "fb_1", seenBy: "admin_1" });
    const markSeenMany = await service.markSeenMany({ ids: ["fb_1", "fb_1", "fb_2"], seenBy: "admin_1" });
    const markSeenAll = await service.markSeenMany({ all: true });
    const resolved = await service.resolve({ id: "fb_1", resolvedBy: "admin_1", adminNote: "Fixed" });
    const resolvedMany = await service.resolveMany({ ids: ["fb_1", "fb_1", "fb_2"], adminNote: "Bulk fixed" });
    const userResolved = await service.userResolve({ id: "fb_1", userId: "user_1", userNote: "Looks fixed" });
    const userReopened = await service.userResolve({ id: "fb_1", userId: "user_1", resolved: false });
    const userNotified = await service.notifyUser({ id: "fb_1", notifiedBy: "admin_1" });

    assert.equal(calls.listForUser[0].limit, 200);
    assert.equal(calls.listForAdmin[0].type, "feature");
    assert.equal(calls.listForAdmin[0].changedSince, "2026-06-04T00:00:00.000Z");
    assert.equal(calls.listForAdmin[0].createdSince, "2026-06-03T00:00:00.000Z");
    assert.equal(calls.listForAdmin[0].resolved, false);
    assert.equal(calls.listForAdmin[0].seen, true);
    assert.equal(calls.listForAdmin[0].limit, 500);
    assert.equal(calls.markSeen[0].seenAt, "2026-06-05T01:00:00.000Z");
    assert.deepEqual(calls.markSeenMany[0].ids, ["fb_1", "fb_2"]);
    assert.equal(calls.markSeenMany[0].seenAt, "2026-06-05T01:00:00.000Z");
    assert.equal(calls.markSeenMany[1].all, true);
    assert.equal(markSeenMany.count, 2);
    assert.equal(markSeenAll.count, 12);
    assert.equal(calls.resolve[0].adminNote, "Fixed");
    assert.deepEqual(calls.resolveMany[0].ids, ["fb_1", "fb_2"]);
    assert.equal(calls.resolveMany[0].adminNote, "Bulk fixed");
    assert.equal(resolvedMany.count, 2);
    assert.equal(resolved.status, "resolved");
    assert.equal(calls.userResolve[0].userResolvedAt, "2026-06-05T01:00:00.000Z");
    assert.equal(calls.userResolve[0].userNote, "Looks fixed");
    assert.equal(userResolved.status, "user_resolved");
    assert.equal(calls.userResolve[1].userResolvedAt, null);
    assert.equal(userReopened.status, "open");
    assert.equal(calls.markUserNotified[0].notifiedAt, "2026-06-05T01:00:00.000Z");
    assert.equal(calls.markUserNotified[0].notifiedBy, "admin_1");
    assert.equal(userNotified.status, "notified");
    assert.deepEqual(userResolveNotifications, ["fb_1", "fb_1"]);
    assert.deepEqual(userNotifiedNotifications, ["fb_1"]);
    await assert.rejects(() => service.resolveMany({ ids: [] }), /ids/);
  });
});

describe("feedback input normalizers", () => {
  it("normalizes feedback type aliases", () => {
    assert.equal(normalizeFeedbackType("BUG"), "bug");
    assert.equal(normalizeFeedbackType("suggestion"), "feature");
    assert.equal(normalizeFeedbackType(undefined), "other");
  });

  it("rejects inline attachment data and invalid storage keys", () => {
    assert.throws(
      () => normalizeFeedbackAttachment({ kind: "screenshot", storageKey: "feedback/fb_1.jpg", data: RAW_B64 }),
      /inline data/
    );
    assert.throws(
      () => normalizeFeedbackAttachment({ kind: "screenshot", storageKey: "https://example.com/fb.jpg" }),
      /storageKey/
    );
  });

  it("normalizes attachment upload response status", () => {
    assert.deepEqual(FEEDBACK_ATTACHMENT_STATUS_ERRORS, [
      "validation_failed",
      "upload_failed",
      "storage_unavailable",
      "not_provided",
      "unknown",
    ]);
    assert.deepEqual(normalizeFeedbackAttachmentStatus({ attached: true, error: "validation_failed" }), {
      attached: true,
    });
    assert.deepEqual(normalizeFeedbackAttachmentStatus({ attached: false, error: "validation_failed" }), {
      attached: false,
      error: "validation_failed",
    });
    assert.deepEqual(normalizeFeedbackAttachmentStatus({ attached: false, reason: "upload_failed" }), {
      attached: false,
      error: "upload_failed",
    });
    assert.equal(normalizeFeedbackAttachmentStatusError("vendor_specific_failure"), "unknown");
    assert.deepEqual(normalizeFeedbackAttachmentStatus({ attached: false, error: "vendor_specific_failure" }), {
      attached: false,
      error: "unknown",
    });
    assert.throws(() => normalizeFeedbackAttachmentStatus(null), /status/);
  });

  it("rejects blank feedback content", () => {
    assert.throws(() => normalizeCreateFeedbackInput({ type: "bug", content: "   " }), /content/);
  });

  it("builds structured feedback content with default headings", () => {
    assert.deepEqual(STRUCTURED_FEEDBACK_FIELDS, [
      "observedBehavior",
      "expectedBehavior",
      "suspectedCause",
    ]);
    assert.deepEqual(DEFAULT_STRUCTURED_FEEDBACK_HEADINGS, {
      observedBehavior: "Observed behavior",
      expectedBehavior: "Expected behavior",
      suspectedCause: "Suspected cause",
    });
    assert.equal(
      buildStructuredFeedbackContent({
        observedBehavior: "  It froze after submit.  ",
        expectedBehavior: "\n",
        suspectedCause: "log flush held the form open",
      }),
      [
        "Observed behavior",
        "It froze after submit.",
        "",
        "Suspected cause",
        "log flush held the form open",
      ].join("\n")
    );
  });

  it("normalizes structured feedback aliases and rejects missing observed behavior", () => {
    assert.deepEqual(
      normalizeStructuredFeedbackInput({
        bugSymptom: "sheet disappeared",
        expected: "draft remains",
        possibleRootCause: "state lived only in the sheet",
      }),
      {
        observedBehavior: "sheet disappeared",
        expectedBehavior: "draft remains",
        suspectedCause: "state lived only in the sheet",
      }
    );
    assert.throws(
      () => buildStructuredFeedbackContent({ expectedBehavior: "show a warning" }),
      /observedBehavior/
    );
    assert.equal(
      buildStructuredFeedbackContent(
        { expectedBehavior: "show a warning" },
        { requireObservedBehavior: false }
      ),
      "Expected behavior\nshow a warning"
    );
  });
});

describe("storeFeedbackAttachment", () => {
  it("validates bytes, writes object storage, and returns an attachment record", async () => {
    const writes = [];
    const result = await storeFeedbackAttachment({
      objectStore: {
        async putObject(input) {
          writes.push(input);
          return { key: input.key, contentType: input.contentType, byteSize: input.body.byteLength };
        },
      },
      body: PNG_BYTES,
      declaredContentType: "image/png",
      kind: "annotated_screenshot",
      purpose: "feedback",
      ids: ["project-1", "fb_1"],
      randomId: "shot-1",
      now: new Date("2026-06-05T00:00:00.000Z"),
      cacheControl: "private,max-age=60",
      metadata: { feedbackId: "fb_1" },
      width: 390,
      height: 844,
    });

    assert.deepEqual(DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES, [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, "feedback/project-1/fb_1/1780617600000-shot-1.png");
    assert.equal(writes[0].contentType, "image/png");
    assert.equal(writes[0].body, PNG_BYTES);
    assert.equal(writes[0].cacheControl, "private,max-age=60");
    assert.deepEqual(writes[0].metadata, { feedbackId: "fb_1" });
    assert.deepEqual(result.attachment, {
      id: undefined,
      kind: "annotated_screenshot",
      storageKey: "feedback/project-1/fb_1/1780617600000-shot-1.png",
      contentType: "image/png",
      byteSize: PNG_BYTES.byteLength,
      width: 390,
      height: 844,
      createdAt: "2026-06-05T00:00:00.000Z",
    });
    assert.equal(result.validation.ok, true);
  });

  it("uses detected image content type when the declaration is missing", async () => {
    const result = await storeFeedbackAttachment({
      objectStore: {
        async putObject(input) {
          return { key: input.key, contentType: input.contentType, byteSize: input.body.byteLength };
        },
      },
      body: PNG_BYTES.buffer,
      storageKey: "feedback/fb_1/screenshot.png",
      kind: "screenshot",
      now: new Date("2026-06-05T00:00:00.000Z"),
    });

    assert.equal(result.attachment.storageKey, "feedback/fb_1/screenshot.png");
    assert.equal(result.attachment.contentType, "image/png");
  });

  it("rejects invalid or inline uploads before writing object storage", async () => {
    const writes = [];
    await assert.rejects(
      () => storeFeedbackAttachment({
        objectStore: {
          async putObject(input) {
            writes.push(input);
            return { key: input.key, contentType: input.contentType, byteSize: input.body.byteLength };
          },
        },
        body: Buffer.from("not an image"),
        declaredContentType: "image/png",
      }),
      (error) => {
        assert.equal(error.code, "feedback.attachment_upload_invalid");
        assert.deepEqual(error.details.errors, ["missing_detected_content_type"]);
        return true;
      }
    );
    await assert.rejects(
      () => storeFeedbackAttachment({
        objectStore: {
          async putObject(input) {
            writes.push(input);
            return { key: input.key, contentType: input.contentType, byteSize: input.body.byteLength };
          },
        },
        body: PNG_BYTES,
        base64: RAW_B64,
      }),
      /inline data/
    );
    assert.equal(writes.length, 0);
  });

  it("exports the attachment helper from the CommonJS entry", () => {
    const cjs = require("../src/index.cjs");
    assert.equal(typeof cjs.storeFeedbackAttachment, "function");
    assert.equal(typeof cjs.normalizeFeedbackAttachmentStatus, "function");
    assert.equal(typeof cjs.buildStructuredFeedbackContent, "function");
    assert.deepEqual(cjs.DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES, DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES);
    assert.deepEqual(cjs.FEEDBACK_ATTACHMENT_STATUS_ERRORS, FEEDBACK_ATTACHMENT_STATUS_ERRORS);
  });
});
