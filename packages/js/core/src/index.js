export const DEFAULT_DEBUG_PAYLOAD_MAX_BYTES = 256 * 1024;

export class AppFoundryError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = "AppFoundryError";
    this.code = code;
    this.details = details;
  }
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

export function byteLengthUtf8(value) {
  return new TextEncoder().encode(value).length;
}

export function truncateJsonValue(value, maxBytes = DEFAULT_DEBUG_PAYLOAD_MAX_BYTES) {
  if (value == null) return value;
  try {
    const json = JSON.stringify(value);
    if (byteLengthUtf8(json) <= maxBytes) return value;
    return {
      __truncated: true,
      originalBytes: byteLengthUtf8(json),
      head: json.slice(0, maxBytes),
    };
  } catch {
    return { __unserializable: true };
  }
}

export function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
