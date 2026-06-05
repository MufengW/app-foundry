"use strict";

const DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/ogg",
];

const DEFAULT_ALLOWED_MEDIA_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "mp4",
  "mov",
  "webm",
  "m4a",
  "m4b",
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
];

const UUID_WITH_EXT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m4a|m4b|mp3|wav|ogg|oga|opus)$/i;

function isObjectKey(value, options = {}) {
  if (typeof value !== "string") return false;
  if (!value || value.length > (options.maxLength ?? 512)) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("..")) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;

  const extension = extensionFromKey(value);
  const allowedExtensions = options.allowedExtensions ?? DEFAULT_ALLOWED_MEDIA_EXTENSIONS;
  if (!extension || !allowedExtensions.includes(extension.toLowerCase())) return false;

  if (options.strictLegacyR2Key === true) {
    return /^(thumb_[A-Za-z0-9._-]+|avatar-[A-Za-z0-9._-]+|feedback-[A-Za-z0-9._-]+|u-[A-Za-z0-9._-]+)\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m4a|m4b|mp3|wav|ogg|oga|opus)$/i.test(value) ||
      UUID_WITH_EXT_RE.test(value);
  }

  return value
    .split("/")
    .every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part));
}

function extractObjectKey(value, options = {}) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (isObjectKey(value, options)) return value;

  const legacyUploadPrefix = options.legacyUploadPrefix ?? "/uploads/";
  if (legacyUploadPrefix && value.startsWith(legacyUploadPrefix)) {
    const key = value.slice(legacyUploadPrefix.length).split("?")[0];
    return isObjectKey(key, options) ? key : null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const baseUrlKey = extractFromAllowedBaseUrl(value, parsed, options.allowedBaseUrls ?? [], options);
  if (baseUrlKey) return baseUrlKey;

  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const originAllowed = allowedOrigins.has(parsed.origin);
  if (!originAllowed) return null;

  const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  return isObjectKey(key, options) ? key : null;
}

function createObjectKey(input = {}) {
  const purpose = sanitizePathPart(input?.purpose ?? "media");
  const extension = sanitizeExtension(input?.extension ?? input?.contentType ?? "bin");
  const now = input?.now instanceof Date ? input.now : new Date();
  const ids = Array.isArray(input?.ids) ? input.ids.map(sanitizePathPart).filter(Boolean) : [];
  const randomId = sanitizePathPart(input?.randomId ?? cryptoRandomId());
  return [purpose, ...ids, `${now.getTime()}-${randomId}.${extension}`].join("/");
}

function validateUpload(input = {}) {
  const allowedContentTypes = input?.allowedContentTypes ?? DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES;
  const declared = normalizeContentType(input?.declaredContentType);
  const detected = normalizeContentType(input?.detectedContentType);
  const maxBytes = input?.maxBytes ?? 10 * 1024 * 1024;
  const byteSize = Number(input?.byteSize);
  const requireDetectedContentType = input?.requireDetectedContentType === true;
  const errors = [];

  if (!Number.isFinite(byteSize) || byteSize < 0) errors.push("invalid_byte_size");
  if (Number.isFinite(byteSize) && byteSize > maxBytes) errors.push("file_too_large");
  if (!declared) errors.push("missing_declared_content_type");
  if (requireDetectedContentType && !detected) errors.push("missing_detected_content_type");
  if (declared && !allowedContentTypes.includes(declared)) errors.push("declared_content_type_not_allowed");
  if (
    detected &&
    !allowedContentTypes.includes(detected) &&
    !(declared && allowedContentTypes.includes(declared) && contentTypesMatch(declared, detected))
  ) errors.push("detected_content_type_not_allowed");
  if (declared && detected && !contentTypesMatch(declared, detected)) errors.push("content_type_mismatch");

  return {
    ok: errors.length === 0,
    errors,
    contentType: detected ?? declared ?? null,
    byteSize: Number.isFinite(byteSize) ? byteSize : null,
  };
}

function detectUploadContentType(bytes) {
  const view = toUint8Array(bytes);
  if (!view || view.length < 4) return null;

  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (
    view.length >= 8 &&
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47 &&
    view[4] === 0x0d &&
    view[5] === 0x0a &&
    view[6] === 0x1a &&
    view[7] === 0x0a
  ) return "image/png";
  if (
    view.length >= 6 &&
    view[0] === 0x47 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x38 &&
    (view[4] === 0x37 || view[4] === 0x39) &&
    view[5] === 0x61
  ) return "image/gif";
  if (
    view.length >= 12 &&
    asciiAt(view, 0, 4) === "RIFF" &&
    asciiAt(view, 8, 4) === "WEBP"
  ) return "image/webp";
  if (
    view.length >= 12 &&
    asciiAt(view, 0, 4) === "RIFF" &&
    asciiAt(view, 8, 4) === "WAVE"
  ) return "audio/wav";
  if (view.length >= 12 && asciiAt(view, 4, 4) === "ftyp") {
    const brand = asciiAt(view, 8, 4).toLowerCase();
    if (brand === "qt  ") return "video/quicktime";
    if (brand === "m4a " || brand === "m4b " || brand === "m4p ") return "audio/mp4";
    return "video/mp4";
  }
  if (
    view.length >= 4 &&
    view[0] === 0x1a &&
    view[1] === 0x45 &&
    view[2] === 0xdf &&
    view[3] === 0xa3
  ) return "video/webm";
  if (asciiAt(view, 0, 4) === "OggS") return "audio/ogg";
  if (asciiAt(view, 0, 3) === "ID3") return "audio/mpeg";
  if (view[0] === 0xff && (view[1] & 0xe0) === 0xe0) return "audio/mpeg";

  return null;
}

function extensionFromKey(value) {
  const match = /\.([A-Za-z0-9]+)$/.exec(value);
  return match ? match[1].toLowerCase() : null;
}

function normalizeContentType(value) {
  if (typeof value !== "string") return null;
  const [type] = value.toLowerCase().split(";");
  const trimmed = type.trim();
  return trimmed || null;
}

function contentTypesMatch(declared, detected) {
  if (declared === detected) return true;
  const isoBmffMimes = new Set(["video/mp4", "video/quicktime", "audio/mp4", "audio/m4a"]);
  if (isoBmffMimes.has(declared) && isoBmffMimes.has(detected)) return true;
  const webmMimes = new Set(["video/webm", "audio/webm"]);
  if (webmMimes.has(declared) && webmMimes.has(detected)) return true;
  const wavMimes = new Set(["audio/wav", "audio/x-wav"]);
  return wavMimes.has(declared) && wavMimes.has(detected);
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function asciiAt(bytes, start, length) {
  if (bytes.length < start + length) return "";
  let out = "";
  for (let index = start; index < start + length; index += 1) {
    out += String.fromCharCode(bytes[index]);
  }
  return out;
}

function extractFromAllowedBaseUrl(value, parsed, allowedBaseUrls, options) {
  for (const baseUrl of allowedBaseUrls) {
    let base;
    try {
      base = new URL(baseUrl);
    } catch {
      continue;
    }
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    if (!value.startsWith(normalizedBase)) continue;
    if (parsed.origin !== base.origin) continue;

    const basePath = base.pathname.replace(/\/+$/, "");
    const keyPath = parsed.pathname.startsWith(`${basePath}/`)
      ? parsed.pathname.slice(basePath.length + 1)
      : parsed.pathname.replace(/^\/+/, "");
    const key = decodeURIComponent(keyPath);
    return isObjectKey(key, options) ? key : null;
  }
  return null;
}

function sanitizeExtension(value) {
  const text = String(value).toLowerCase();
  if (text.includes("/")) {
    const map = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/m4a": "m4a",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
    };
    return map[text] ?? "bin";
  }
  const cleaned = text.replace(/^\./, "").replace(/[^a-z0-9]/g, "");
  return cleaned || "bin";
}

function sanitizePathPart(value) {
  return String(value)
    .trim()
    .replace(/\.+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

module.exports = {
  DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES,
  DEFAULT_ALLOWED_MEDIA_EXTENSIONS,
  isObjectKey,
  extractObjectKey,
  createObjectKey,
  validateUpload,
  detectUploadContentType,
};
