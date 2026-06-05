import { AppFoundryError } from "@app-foundry/core";
import { isObjectKey } from "@app-foundry/media";

export const DEFAULT_SIGNED_READ_URL_EXPIRES_IN_SECONDS = 3600;

export function createS3ObjectStore(options) {
  if (!options || typeof options !== "object") {
    throw new AppFoundryError("S3 object store options are required.", "storage_s3.options_required");
  }

  if (hasDirectOperations(options)) {
    return createDirectObjectStore(options);
  }

  const bucket = requireString(options.bucket, "bucket");
  const client = options.client;
  const commands = options.commands;
  if (!client?.send || !commands?.PutObjectCommand || !commands?.DeleteObjectCommand || !commands?.GetObjectCommand) {
    throw new AppFoundryError(
      "S3 client mode requires client.send and PutObject/DeleteObject/GetObject command constructors.",
      "storage_s3.client_invalid"
    );
  }

  return {
    async putObject(input) {
      const normalized = normalizePutObjectInput(input);
      const commandInput = toS3PutObjectInput(bucket, normalized);
      await client.send(new commands.PutObjectCommand(commandInput));
      return {
        key: normalized.key,
        contentType: normalized.contentType,
        byteSize: byteSizeOf(normalized.body),
      };
    },

    async deleteObject(key) {
      assertObjectKey(key);
      await client.send(new commands.DeleteObjectCommand(toS3DeleteObjectInput(bucket, key)));
    },

    async getSignedReadUrl(input) {
      const key = requireString(input?.key, "key");
      assertObjectKey(key);
      const expiresInSeconds =
        input?.expiresInSeconds ?? options.defaultExpiresInSeconds ?? DEFAULT_SIGNED_READ_URL_EXPIRES_IN_SECONDS;
      const command = new commands.GetObjectCommand(toS3GetObjectInput(bucket, key));

      if (typeof options.getSignedUrl === "function") {
        const url = await options.getSignedUrl(client, command, { expiresIn: expiresInSeconds });
        return signedUrlResult(url, expiresInSeconds, options.clock);
      }
      if (typeof options.presignReadUrl === "function") {
        const url = await options.presignReadUrl({ bucket, key, expiresInSeconds, command, client });
        return signedUrlResult(url, expiresInSeconds, options.clock);
      }
      throw new AppFoundryError("S3 object store requires getSignedUrl or presignReadUrl.", "storage_s3.presigner_required");
    },
  };
}

export function toS3PutObjectInput(bucket, input) {
  const normalized = normalizePutObjectInput(input);
  return {
    Bucket: requireString(bucket, "bucket"),
    Key: normalized.key,
    Body: normalized.body,
    ContentType: normalized.contentType,
    CacheControl: normalized.cacheControl,
    Metadata: normalized.metadata,
  };
}

export function toS3DeleteObjectInput(bucket, key) {
  assertObjectKey(key);
  return {
    Bucket: requireString(bucket, "bucket"),
    Key: key,
  };
}

export function toS3GetObjectInput(bucket, key) {
  assertObjectKey(key);
  return {
    Bucket: requireString(bucket, "bucket"),
    Key: key,
  };
}

function createDirectObjectStore(options) {
  return {
    async putObject(input) {
      const normalized = normalizePutObjectInput(input);
      const stored = await options.putObject(normalized);
      return {
        key: stored?.key ?? normalized.key,
        contentType: stored?.contentType ?? normalized.contentType,
        byteSize: stored?.byteSize ?? byteSizeOf(normalized.body),
        url: stored?.url,
      };
    },
    async deleteObject(key) {
      assertObjectKey(key);
      await options.deleteObject(key);
    },
    async getSignedReadUrl(input) {
      const key = requireString(input?.key, "key");
      assertObjectKey(key);
      return options.getSignedReadUrl(input);
    },
  };
}

function hasDirectOperations(options) {
  return typeof options.putObject === "function" &&
    typeof options.deleteObject === "function" &&
    typeof options.getSignedReadUrl === "function";
}

function normalizePutObjectInput(input) {
  const key = requireString(input?.key, "key");
  assertObjectKey(key);
  const contentType = requireString(input?.contentType, "contentType");
  const body = input?.body;
  if (!(body instanceof Uint8Array)) {
    throw new AppFoundryError("putObject body must be a Uint8Array.", "storage_s3.body_invalid");
  }
  return {
    key,
    body,
    contentType,
    cacheControl: typeof input.cacheControl === "string" ? input.cacheControl : undefined,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeMetadata(metadata) {
  if (metadata == null) return undefined;
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new AppFoundryError("S3 metadata must be an object.", "storage_s3.metadata_invalid");
  }
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function assertObjectKey(key) {
  if (!isObjectKey(key)) {
    throw new AppFoundryError(`Invalid object key: ${String(key)}`, "storage_s3.key_invalid");
  }
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new AppFoundryError(`${fieldName} must be a non-empty string.`, `storage_s3.${fieldName}_invalid`);
  }
  return value;
}

function byteSizeOf(body) {
  return body?.byteLength ?? 0;
}

function signedUrlResult(url, expiresInSeconds, clock) {
  const now = typeof clock === "function" ? clock() : new Date();
  return {
    url,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
  };
}
