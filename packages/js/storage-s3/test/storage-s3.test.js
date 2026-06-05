import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createS3ObjectStore,
  toS3DeleteObjectInput,
  toS3GetObjectInput,
  toS3PutObjectInput,
} from "../src/index.js";

class PutObjectCommand {
  constructor(input) {
    this.input = input;
    this.kind = "put";
  }
}

class DeleteObjectCommand {
  constructor(input) {
    this.input = input;
    this.kind = "delete";
  }
}

class GetObjectCommand {
  constructor(input) {
    this.input = input;
    this.kind = "get";
  }
}

describe("S3 command input helpers", () => {
  it("builds S3 command inputs from AppFoundry object-store inputs", () => {
    const body = new Uint8Array([1, 2, 3]);
    assert.deepEqual(toS3PutObjectInput("bucket", {
      key: "feedback/project/report.jpg",
      body,
      contentType: "image/jpeg",
      cacheControl: "public,max-age=60",
      metadata: { feedbackId: "fb_1", ignored: 123 },
    }), {
      Bucket: "bucket",
      Key: "feedback/project/report.jpg",
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public,max-age=60",
      Metadata: { feedbackId: "fb_1" },
    });
    assert.deepEqual(toS3DeleteObjectInput("bucket", "feedback/project/report.jpg"), {
      Bucket: "bucket",
      Key: "feedback/project/report.jpg",
    });
    assert.deepEqual(toS3GetObjectInput("bucket", "feedback/project/report.jpg"), {
      Bucket: "bucket",
      Key: "feedback/project/report.jpg",
    });
  });

  it("rejects invalid object keys before constructing S3 commands", () => {
    assert.throws(
      () => toS3GetObjectInput("bucket", "https://example.com/report.jpg"),
      /Invalid object key/
    );
  });
});

describe("createS3ObjectStore", () => {
  it("uses injected S3 client, command constructors, and presigner", async () => {
    const sent = [];
    const client = {
      async send(command) {
        sent.push(command);
      },
    };
    const store = createS3ObjectStore({
      bucket: "media",
      client,
      commands: { PutObjectCommand, DeleteObjectCommand, GetObjectCommand },
      async getSignedUrl(_client, command, options) {
        assert.equal(command.kind, "get");
        assert.equal(options.expiresIn, 60);
        return `https://signed.example.com/${command.input.Key}`;
      },
      clock: () => new Date("2026-06-05T01:00:00.000Z"),
    });

    const body = new Uint8Array([1, 2, 3, 4]);
    const stored = await store.putObject({
      key: "feedback/project/report.jpg",
      body,
      contentType: "image/jpeg",
    });
    await store.deleteObject("feedback/project/report.jpg");
    const signed = await store.getSignedReadUrl({
      key: "feedback/project/report.jpg",
      expiresInSeconds: 60,
    });

    assert.deepEqual(stored, {
      key: "feedback/project/report.jpg",
      contentType: "image/jpeg",
      byteSize: 4,
    });
    assert.equal(sent[0].kind, "put");
    assert.equal(sent[1].kind, "delete");
    assert.deepEqual(signed, {
      url: "https://signed.example.com/feedback/project/report.jpg",
      expiresAt: "2026-06-05T01:01:00.000Z",
    });
  });

  it("supports direct ObjectStore operation injection for tests and custom providers", async () => {
    const calls = [];
    const store = createS3ObjectStore({
      async putObject(input) {
        calls.push(["put", input.key]);
        return { key: input.key, contentType: input.contentType, byteSize: input.body.byteLength };
      },
      async deleteObject(key) {
        calls.push(["delete", key]);
      },
      async getSignedReadUrl(input) {
        calls.push(["sign", input.key]);
        return { url: `memory://${input.key}` };
      },
    });

    await store.putObject({
      key: "media/user/photo.png",
      body: new Uint8Array([1]),
      contentType: "image/png",
    });
    await store.deleteObject("media/user/photo.png");
    const signed = await store.getSignedReadUrl({ key: "media/user/photo.png" });

    assert.deepEqual(calls, [
      ["put", "media/user/photo.png"],
      ["delete", "media/user/photo.png"],
      ["sign", "media/user/photo.png"],
    ]);
    assert.equal(signed.url, "memory://media/user/photo.png");
  });
});
