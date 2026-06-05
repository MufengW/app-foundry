import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIO_UPLOAD_CONTENT_TYPES,
  createObjectKey,
  detectUploadContentType,
  extractObjectKey,
  IMAGE_UPLOAD_CONTENT_TYPES,
  isObjectKey,
  validateBase64Upload,
  validateUpload,
  validateUploadBytes,
} from "../src/index.js";

describe("object key helpers", () => {
  it("accepts AppFoundry-style partitioned object keys", () => {
    assert.equal(isObjectKey("feedback/project-1/report-2/attachment-3.jpg"), true);
    assert.equal(isObjectKey("media/user-1/1775357022243-photo.webp"), true);
    assert.equal(isObjectKey("ai-audio/user-1/1775357022243-clip.wav"), true);
    assert.equal(isObjectKey("ai-audio/user-1/1775357022243-clip.m4a"), true);
  });

  it("can validate legacy S3-compatible object key shapes in strict mode", () => {
    const options = { strictLegacyR2Key: true };
    assert.equal(isObjectKey("u-abc_m-def_t-123_xy12.jpg", options), true);
    assert.equal(isObjectKey("thumb_u-abc_m-def_t-123_xy12.jpg", options), true);
    assert.equal(isObjectKey("avatar-user1.png", options), true);
    assert.equal(isObjectKey("feedback-12345678-1234-1234-1234-123456789abc.jpg", options), true);
    assert.equal(isObjectKey("dcc316f7-2033-4634-afb7-0790086399c4.mov", options), true);
  });

  it("rejects URLs, path traversal, and unsupported extensions", () => {
    assert.equal(isObjectKey("https://media.example.com/u-abc.jpg"), false);
    assert.equal(isObjectKey("/uploads/photo.jpg"), false);
    assert.equal(isObjectKey("../secret.jpg"), false);
    assert.equal(isObjectKey("media/user/file.pdf"), false);
  });

  it("extracts object keys from allowed bucket URLs and legacy upload paths", () => {
    assert.equal(
      extractObjectKey("https://media.example.com/feedback/project/report.jpg", {
        allowedOrigins: ["https://media.example.com"],
      }),
      "feedback/project/report.jpg"
    );
    assert.equal(
      extractObjectKey("https://media.example.com/u-abc.jpg?sig=test", {
        allowedBaseUrls: ["https://media.example.com"],
        strictLegacyR2Key: true,
      }),
      "u-abc.jpg"
    );
    assert.equal(
      extractObjectKey("https://cdn.example.com/private-bucket/feedback/report.jpg?sig=test", {
        allowedBaseUrls: ["https://cdn.example.com/private-bucket"],
      }),
      "feedback/report.jpg"
    );
    assert.equal(
      extractObjectKey("/uploads/avatar-user1.png?exp=1&sig=abc", {
        strictLegacyR2Key: true,
      }),
      "avatar-user1.png"
    );
    assert.equal(extractObjectKey("https://other.example.com/u-abc.jpg"), null);
  });

  it("creates app-controlled keys without raw user filenames", () => {
    const key = createObjectKey({
      purpose: "feedback screenshots",
      ids: ["user/../1", "report 2"],
      contentType: "image/jpeg",
      now: new Date("2026-06-05T00:00:00.000Z"),
      randomId: "abc123",
    });

    assert.equal(key, "feedback-screenshots/user-1/report-2/1780617600000-abc123.jpg");
    assert.equal(isObjectKey(key), true);
  });
});

describe("validateUpload", () => {
  it("accepts matching declared and detected content types", () => {
    const result = validateUpload({
      declaredContentType: "image/jpeg",
      detectedContentType: "image/jpeg",
      byteSize: 1024,
      maxBytes: 2048,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.contentType, "image/jpeg");
  });

  it("rejects declared MIME only when magic bytes disagree", () => {
    const result = validateUpload({
      declaredContentType: "image/jpeg",
      detectedContentType: "image/png",
      byteSize: 1024,
      maxBytes: 2048,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["content_type_mismatch"]);
  });

  it("allows MP4 and QuickTime declarations to share ISO-BMFF detections", () => {
    const result = validateUpload({
      declaredContentType: "video/quicktime",
      detectedContentType: "video/mp4",
      byteSize: 1024,
      maxBytes: 2048,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it("allows audio declarations to share compatible container detections", () => {
    const webm = validateUpload({
      declaredContentType: "audio/webm",
      detectedContentType: "video/webm",
      allowedContentTypes: ["audio/webm"],
      byteSize: 1024,
      maxBytes: 2048,
    });
    const mp4 = validateUpload({
      declaredContentType: "audio/m4a",
      detectedContentType: "video/mp4",
      allowedContentTypes: ["audio/m4a", "audio/mp4"],
      byteSize: 1024,
      maxBytes: 2048,
    });
    const wav = validateUpload({
      declaredContentType: "audio/x-wav",
      detectedContentType: "audio/wav",
      allowedContentTypes: ["audio/x-wav"],
      byteSize: 1024,
      maxBytes: 2048,
    });

    assert.equal(webm.ok, true);
    assert.deepEqual(webm.errors, []);
    assert.equal(mp4.ok, true);
    assert.deepEqual(mp4.errors, []);
    assert.equal(wav.ok, true);
    assert.deepEqual(wav.errors, []);
  });

  it("rejects oversized and unsupported uploads", () => {
    const result = validateUpload({
      declaredContentType: "application/pdf",
      byteSize: 4096,
      maxBytes: 1024,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["file_too_large", "declared_content_type_not_allowed"]);
  });

  it("requires detected content type when configured", () => {
    const result = validateUpload({
      declaredContentType: "image/png",
      byteSize: 1024,
      requireDetectedContentType: true,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["missing_detected_content_type"]);
  });
});

describe("validateUploadBytes", () => {
  it("detects and validates bytes in one call", () => {
    const result = validateUploadBytes({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      maxBytes: 1024,
      allowedContentTypes: IMAGE_UPLOAD_CONTENT_TYPES,
      requireDetectedContentType: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.declaredContentType, "image/png");
    assert.equal(result.detectedContentType, "image/png");
    assert.equal(result.contentType, "image/png");
    assert.equal(result.extension, "png");
    assert.equal(result.byteSize, 8);
  });

  it("preserves declared audio content type for compatible containers when requested", () => {
    const result = validateUploadBytes({
      bytes: new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
      declaredContentType: "audio/m4a",
      maxBytes: 1024,
      allowedContentTypes: AUDIO_UPLOAD_CONTENT_TYPES,
      requireDetectedContentType: true,
      preferDeclaredContentType: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.detectedContentType, "video/mp4");
    assert.equal(result.contentType, "audio/m4a");
    assert.equal(result.extension, "m4a");
  });

  it("rejects invalid byte inputs", () => {
    const result = validateUploadBytes({ bytes: "not bytes" });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["invalid_bytes"]);
    assert.equal(result.bytes, null);
  });
});

describe("validateBase64Upload", () => {
  it("decodes data URIs and validates detected content", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
    const result = validateBase64Upload({
      data: `data:image/png;base64,${png}`,
      maxBytes: 1024,
      allowedContentTypes: IMAGE_UPLOAD_CONTENT_TYPES,
      requireDetectedContentType: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.declaredContentType, "image/png");
    assert.equal(result.detectedContentType, "image/png");
    assert.equal(result.contentType, "image/png");
    assert.equal(result.bytes?.byteLength, 8);
  });

  it("rejects non-base64 payloads before MIME validation", () => {
    const result = validateBase64Upload({
      data: "not valid base64%",
      allowedContentTypes: IMAGE_UPLOAD_CONTENT_TYPES,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["invalid_base64"]);
  });

  it("can reject data URIs when callers only accept raw base64", () => {
    const result = validateBase64Upload({
      data: "data:image/png;base64,AAAA",
      allowDataUri: false,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["data_uri_not_allowed"]);
  });
});

describe("detectUploadContentType", () => {
  it("sniffs common image signatures", () => {
    assert.equal(detectUploadContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(detectUploadContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    assert.equal(detectUploadContentType(Buffer.from("GIF89a", "ascii")), "image/gif");
    assert.equal(detectUploadContentType(Buffer.from("RIFFxxxxWEBP", "ascii")), "image/webp");
  });

  it("sniffs common video container signatures", () => {
    assert.equal(
      detectUploadContentType(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])),
      "video/mp4"
    );
    assert.equal(
      detectUploadContentType(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20])),
      "video/quicktime"
    );
    assert.equal(detectUploadContentType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), "video/webm");
  });

  it("sniffs common audio signatures", () => {
    assert.equal(detectUploadContentType(Buffer.from("RIFFxxxxWAVEfmt ", "ascii")), "audio/wav");
    assert.equal(detectUploadContentType(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02])), "audio/ogg");
    assert.equal(detectUploadContentType(new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00])), "audio/mpeg");
    assert.equal(detectUploadContentType(new Uint8Array([0xff, 0xfb, 0x90, 0x64])), "audio/mpeg");
    assert.equal(
      detectUploadContentType(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])),
      "audio/mp4"
    );
  });

  it("returns null for unknown or tiny payloads", () => {
    assert.equal(detectUploadContentType(new Uint8Array([0x00, 0x01, 0x02])), null);
    assert.equal(detectUploadContentType("not bytes"), null);
  });
});
