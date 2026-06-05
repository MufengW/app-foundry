import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDebugSnapshot,
  matchesDebugScopes,
  redactPayload,
  sanitizeDebugEvents,
  sanitizeDebugPrefix,
} from "../src/index.js";

const SAMPLE_B64 = Buffer.from("sensitive image bytes").toString("base64");

describe("redactPayload", () => {
  it("redacts known base64 image, audio, and screenshot fields", () => {
    const out = redactPayload({
      photoBase64: SAMPLE_B64,
      imageBase64: SAMPLE_B64,
      avatarBase64: SAMPLE_B64,
      audioBase64: SAMPLE_B64,
      screenshotBase64: SAMPLE_B64,
      keep: "plain text",
    });

    for (const key of ["photoBase64", "imageBase64", "avatarBase64", "audioBase64", "screenshotBase64"]) {
      assert.equal(out[key].__redacted, "base64");
      assert.equal(out[key].bytes, Buffer.from(SAMPLE_B64, "base64").length);
      assert.match(out[key].sha256, /^[0-9a-f]{16}$/);
    }
    assert.equal(out.keep, "plain text");
  });

  it("redacts screenshot string arrays and photo data arrays", () => {
    const out = redactPayload({
      screenshots: [SAMPLE_B64, SAMPLE_B64],
      photos: [{ mimeType: "image/jpeg", data: SAMPLE_B64 }],
    });

    assert.equal(out.screenshots[0].__redacted, "base64");
    assert.equal(out.screenshots[1].__redacted, "base64");
    assert.equal(out.photos[0].data.__redacted, "base64");
    assert.equal(out.photos[0].mimeType, "image/jpeg");
  });

  it("redacts Gemini inlineData and preserves adjacent prompt text", () => {
    const out = redactPayload({
      contents: [
        {
          role: "user",
          parts: [
            { text: "inspect this image" },
            { inlineData: { mimeType: "image/png", data: SAMPLE_B64 } },
          ],
        },
      ],
    });

    assert.equal(out.contents[0].parts[0].text, "inspect this image");
    assert.equal(out.contents[0].parts[1].inlineData.data.__redacted, "base64");
    assert.equal(out.contents[0].parts[1].inlineData.mimeType, "image/png");
  });

  it("redacts secret-like fields case-insensitively and across common key styles", () => {
    const out = redactPayload({
      password: "plain",
      access_token: "access",
      refreshToken: "refresh",
      headers: {
        Authorization: "Bearer token",
        "X-Feedback-Admin-Secret": "admin-secret",
        Cookie: "sid=value",
      },
      nested: {
        geminiKey: "AIza",
        api_key: "key",
        apnsToken: "device",
      },
    });

    assert.deepEqual(out.password, { __redacted: "secret" });
    assert.deepEqual(out.access_token, { __redacted: "secret" });
    assert.deepEqual(out.refreshToken, { __redacted: "secret" });
    assert.deepEqual(out.headers.Authorization, { __redacted: "secret" });
    assert.deepEqual(out.headers["X-Feedback-Admin-Secret"], { __redacted: "secret" });
    assert.deepEqual(out.headers.Cookie, { __redacted: "secret" });
    assert.deepEqual(out.nested.geminiKey, { __redacted: "secret" });
    assert.deepEqual(out.nested.api_key, { __redacted: "secret" });
    assert.deepEqual(out.nested.apnsToken, { __redacted: "secret" });
  });

  it("does not mutate inputs and survives circular objects", () => {
    const input = { photoBase64: SAMPLE_B64, nested: {} };
    input.nested.self = input.nested;
    const out = redactPayload(input);

    assert.equal(typeof input.photoBase64, "string");
    assert.equal(out.photoBase64.__redacted, "base64");
    assert.equal(out.nested.self, "[circular]");
  });
});

describe("debug sanitizers", () => {
  it("sanitizes every payload in a bulk debug ingestion batch", () => {
    const events = sanitizeDebugEvents([
      {
        source: "ios",
        eventType: "feedback_submit",
        debugPrefix: " api / feedback ",
        payload: { screenshotBase64: SAMPLE_B64, token: "secret" },
        occurredAt: "2026-06-05T01:00:00.000Z",
      },
      {
        source: "android",
        eventType: "bulk_photo",
        payload: { screenshots: [SAMPLE_B64] },
        occurredAt: "2026-06-05T01:01:00.000Z",
      },
    ]);

    const text = JSON.stringify(events);
    assert.equal(events.length, 2);
    assert.equal(events[0].debugPrefix, "api_feedback");
    assert.equal(events[0].payload.screenshotBase64.__redacted, "base64");
    assert.equal(events[0].payload.token.__redacted, "secret");
    assert.equal(events[1].payload.screenshots[0].__redacted, "base64");
    assert.doesNotMatch(text, new RegExp(SAMPLE_B64));
  });

  it("normalizes debug prefixes and filters snapshots by scopes", () => {
    assert.equal(sanitizeDebugPrefix(" api / feedback "), "api_feedback");
    assert.equal(matchesDebugScopes({ debugPrefix: "api.feedback.submit" }, ["api.feedback"]), true);
    assert.equal(matchesDebugScopes({ tags: ["party"] }, ["feedback"]), false);

    const snapshot = createDebugSnapshot(
      [
        {
          source: "ios",
          eventType: "tap",
          debugPrefix: "api.feedback",
          payload: { imageBase64: SAMPLE_B64 },
          occurredAt: "2026-06-05T01:00:00.000Z",
        },
        {
          source: "ios",
          eventType: "tap",
          debugPrefix: "api.party",
          payload: { ok: true },
          occurredAt: "2026-06-05T01:00:00.000Z",
        },
      ],
      {
        now: new Date("2026-06-05T01:05:00.000Z"),
        scopes: ["api.feedback"],
      }
    );

    assert.equal(snapshot.eventCount, 1);
    assert.equal(snapshot.events[0].payload.imageBase64.__redacted, "base64");
  });
});
