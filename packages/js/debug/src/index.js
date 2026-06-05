import crypto from "node:crypto";
import {
  DEFAULT_DEBUG_PAYLOAD_MAX_BYTES,
  normalizeStringList,
  truncateJsonValue,
} from "@app-foundry/core";

export const REDACTION_POLICY_VERSION = "appfoundry.redaction.v0";

const DEFAULT_BASE64_KEYS = new Set([
  "photobase64",
  "imagebase64",
  "avatarbase64",
  "audiobase64",
  "screenshotbase64",
]);

const DEFAULT_BASE64_ARRAY_KEYS = new Set([
  "screenshots",
  "photos",
  "imageparts",
  "audioparts",
]);

const DEFAULT_SECRET_KEYS = new Set([
  "password",
  "passwordconfirmation",
  "currentpassword",
  "newpassword",
  "token",
  "authtoken",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "jwt",
  "authorization",
  "cookie",
  "xfeedbackadminsecret",
  "feedbackadminsecret",
  "geminikey",
  "apikey",
  "secret",
  "clientsecret",
  "privatekey",
  "credential",
  "credentials",
  "devicetoken",
  "pushtoken",
  "apnstoken",
]);

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sha16(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

function redactBase64String(value) {
  const bytes = Buffer.from(value, "base64");
  return {
    __redacted: "base64",
    bytes: bytes.length,
    sha256: sha16(bytes),
  };
}

function redactSecret() {
  return { __redacted: "secret" };
}

function toNormalizedSet(values, fallback) {
  if (values == null) return fallback;
  return new Set(Array.from(values, normalizeKey));
}

function buildPolicy(options = {}) {
  return {
    base64Keys: toNormalizedSet(options.base64Keys, DEFAULT_BASE64_KEYS),
    base64ArrayKeys: toNormalizedSet(options.base64ArrayKeys, DEFAULT_BASE64_ARRAY_KEYS),
    secretKeys: toNormalizedSet(options.secretKeys, DEFAULT_SECRET_KEYS),
  };
}

function hasMimeTypeSibling(value) {
  if (!value || typeof value !== "object") return false;
  return Object.prototype.hasOwnProperty.call(value, "mimeType") ||
    Object.prototype.hasOwnProperty.call(value, "mime_type") ||
    Object.prototype.hasOwnProperty.call(value, "contentType") ||
    Object.prototype.hasOwnProperty.call(value, "content_type");
}

function redactValue(value, parentKey, seen, policy) {
  if (value == null) return value;

  if (typeof value === "string") {
    if (parentKey && policy.base64ArrayKeys.has(parentKey)) {
      return redactBase64String(value);
    }
    return value;
  }

  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    return {
      __redacted: "binary",
      bytes: bytes.length,
      sha256: sha16(bytes),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, parentKey, seen, policy));
  }

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (policy.secretKeys.has(normalizedKey)) {
      out[key] = redactSecret();
      continue;
    }

    if (policy.base64Keys.has(normalizedKey) && typeof child === "string") {
      out[key] = redactBase64String(child);
      continue;
    }

    if (normalizedKey === "data" && typeof child === "string" && hasMimeTypeSibling(value)) {
      out[key] = redactBase64String(child);
      continue;
    }

    if (policy.base64ArrayKeys.has(normalizedKey) && Array.isArray(child)) {
      out[key] = child.map((item) => {
        if (typeof item === "string") return redactBase64String(item);
        return redactValue(item, normalizedKey, seen, policy);
      });
      continue;
    }

    out[key] = redactValue(child, normalizedKey, seen, policy);
  }
  return out;
}

export function redactPayload(value, options = {}) {
  return redactValue(value, null, new WeakSet(), buildPolicy(options));
}

export function sanitizeDebugPrefix(value) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 96);
  return cleaned || null;
}

export function safePayload(value, maxBytes = DEFAULT_DEBUG_PAYLOAD_MAX_BYTES, options = {}) {
  return truncateJsonValue(redactPayload(value, options), maxBytes);
}

export function sanitizeDebugEvent(event, options = {}) {
  const source = typeof event?.source === "string" ? event.source.slice(0, 32) : "backend";
  const tags = normalizeStringList(event?.tags).slice(0, 32);
  const occurredAt = normalizeOccurredAt(event?.occurredAt);

  return {
    ...event,
    userId: typeof event?.userId === "string" || event?.userId === null ? event.userId : undefined,
    sessionId: typeof event?.sessionId === "string" ? event.sessionId.slice(0, 128) : undefined,
    requestId: typeof event?.requestId === "string" ? event.requestId.slice(0, 128) : undefined,
    source,
    platform: typeof event?.platform === "string" ? event.platform.slice(0, 32) : undefined,
    level: typeof event?.level === "string" ? event.level.slice(0, 32) : undefined,
    eventType: typeof event?.eventType === "string" ? event.eventType.slice(0, 64) : "unknown",
    screen: typeof event?.screen === "string" ? event.screen.slice(0, 128) : undefined,
    endpoint: typeof event?.endpoint === "string" ? event.endpoint.slice(0, 256) : undefined,
    debugPrefix: sanitizeDebugPrefix(event?.debugPrefix) ?? undefined,
    tags: tags.length ? tags : undefined,
    payload: safePayload(event?.payload ?? null, options.maxPayloadBytes, options.redaction),
    occurredAt,
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
  };
}

export function sanitizeDebugEvents(events, options = {}) {
  if (!Array.isArray(events)) return [];
  const limit = Math.max(0, options.maxEvents ?? events.length);
  return events.slice(0, limit).map((event) => sanitizeDebugEvent(event, options));
}

export function matchesDebugScopes(event, scopes = []) {
  const normalizedScopes = normalizeStringList(scopes);
  if (normalizedScopes.length === 0) return true;
  const tags = normalizeStringList(event?.tags);
  const candidates = [
    event?.debugPrefix,
    event?.screen,
    event?.endpoint,
    event?.eventType,
    ...tags,
  ].filter((value) => typeof value === "string");

  return normalizedScopes.some((scope) =>
    candidates.some((candidate) => candidate === scope || candidate.startsWith(`${scope}.`))
  );
}

export function createDebugSnapshot(events, options = {}) {
  const maxEvents = options.maxEvents ?? 2000;
  const windowMinutes = options.windowMinutes ?? 30;
  const now = options.now instanceof Date ? options.now : new Date();
  const windowStartedAt = options.since instanceof Date
    ? options.since
    : new Date(now.getTime() - windowMinutes * 60 * 1000);
  const windowEndedAt = options.until instanceof Date ? options.until : now;
  const scopes = normalizeStringList(options.scopes);

  const filtered = (Array.isArray(events) ? events : [])
    .filter((event) => {
      const occurredAt = new Date(event?.occurredAt ?? 0);
      if (Number.isNaN(occurredAt.getTime())) return false;
      if (occurredAt < windowStartedAt || occurredAt > windowEndedAt) return false;
      return matchesDebugScopes(event, scopes);
    })
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .slice(-maxEvents);

  return {
    attached: true,
    eventCount: filtered.length,
    windowStartedAt: windowStartedAt.toISOString(),
    windowEndedAt: windowEndedAt.toISOString(),
    scopes,
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
    events: sanitizeDebugEvents(filtered, {
      ...options,
      maxEvents,
    }),
  };
}

function normalizeOccurredAt(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
