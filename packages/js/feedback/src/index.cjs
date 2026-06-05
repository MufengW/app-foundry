"use strict";

const { AppFoundryError, normalizeStringList } = require("@app-foundry/core");
const { createDebugSnapshot, redactPayload } = require("@app-foundry/debug");
const {
  createObjectKey,
  isObjectKey,
  validateUploadBytes,
} = require("@app-foundry/media");

const FEEDBACK_TYPES = ["bug", "feature", "other"];
const FEEDBACK_ATTACHMENT_KINDS = [
  "screenshot",
  "annotated_screenshot",
  "photo",
  "log_archive",
  "other",
];
const DEFAULT_DEBUG_SNAPSHOT_WINDOW_MINUTES = 30;
const DEFAULT_DEBUG_SNAPSHOT_MAX_EVENTS = 2000;
const DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const STRUCTURED_FEEDBACK_FIELDS = [
  "observedBehavior",
  "expectedBehavior",
  "suspectedCause",
];
const DEFAULT_STRUCTURED_FEEDBACK_HEADINGS = {
  observedBehavior: "Observed behavior",
  expectedBehavior: "Expected behavior",
  suspectedCause: "Suspected cause",
};

const FEEDBACK_TYPE_ALIASES = new Map([
  ["bug", "bug"],
  ["bugs", "bug"],
  ["issue", "bug"],
  ["feature", "feature"],
  ["suggestion", "feature"],
  ["request", "feature"],
  ["other", "other"],
]);

function createFeedbackService(options) {
  if (!options?.repository) {
    throw new AppFoundryError("FeedbackRepository is required.", "feedback.repository_required");
  }

  const repository = options.repository;
  const debugLogRepository = options.debugLogRepository ?? null;
  const notifier = options.notifier ?? null;
  const clock = typeof options.clock === "function" ? options.clock : () => new Date();
  const snapshotWindowMinutes =
    options.debugSnapshotWindowMinutes ?? DEFAULT_DEBUG_SNAPSHOT_WINDOW_MINUTES;
  const snapshotMaxEvents = options.debugSnapshotMaxEvents ?? DEFAULT_DEBUG_SNAPSHOT_MAX_EVENTS;

  return {
    async create(input) {
      assertRepositoryMethod(repository, "create");
      const now = clock();
      const createInput = normalizeCreateFeedbackInput(input);
      let debugSnapshot = null;

      if (createInput.attachDebugLogs) {
        debugSnapshot = await buildDebugSnapshot({
          debugLogRepository,
          input: createInput,
          now,
          snapshotWindowMinutes,
          snapshotMaxEvents,
        });
      }

      const record = await repository.create({
        userId: createInput.userId,
        type: createInput.type,
        content: createInput.content,
        context: createInput.context,
        attachments: createInput.attachments,
        debugSnapshot,
        createdAt: now.toISOString(),
      });

      if (notifier?.feedbackCreated) {
        await notifier.feedbackCreated(record);
      }

      return { feedback: record, debugSnapshot };
    },

    async listForUser(query) {
      assertRepositoryMethod(repository, "listForUser");
      return repository.listForUser(normalizeUserFeedbackQuery(query));
    },

    async listForAdmin(query = {}) {
      assertRepositoryMethod(repository, "listForAdmin");
      return repository.listForAdmin(normalizeAdminFeedbackQuery(query));
    },

    async markSeen(input) {
      assertRepositoryMethod(repository, "markSeen");
      return repository.markSeen({
        id: requireString(input?.id, "id"),
        seenBy: typeof input?.seenBy === "string" ? input.seenBy : null,
        seenAt: (input?.seenAt instanceof Date ? input.seenAt : clock()).toISOString(),
      });
    },

    async markSeenMany(input) {
      assertRepositoryMethod(repository, "markSeenMany");
      const all = input?.all === true;
      return repository.markSeenMany({
        ids: all ? [] : normalizeIdList(input?.ids, "ids"),
        all,
        seenBy: typeof input?.seenBy === "string" ? input.seenBy : null,
        seenAt: (input?.seenAt instanceof Date ? input.seenAt : clock()).toISOString(),
      });
    },

    async resolve(input) {
      assertRepositoryMethod(repository, "resolve");
      const record = await repository.resolve({
        id: requireString(input?.id, "id"),
        resolvedBy: typeof input?.resolvedBy === "string" ? input.resolvedBy : null,
        adminNote: typeof input?.adminNote === "string" ? input.adminNote : null,
        resolvedAt: (input?.resolvedAt instanceof Date ? input.resolvedAt : clock()).toISOString(),
      });
      if (notifier?.feedbackResolved) {
        await notifier.feedbackResolved(record);
      }
      return record;
    },

    async resolveMany(input) {
      assertRepositoryMethod(repository, "resolveMany");
      return repository.resolveMany({
        ids: normalizeIdList(input?.ids, "ids"),
        resolvedBy: typeof input?.resolvedBy === "string" ? input.resolvedBy : null,
        adminNote: typeof input?.adminNote === "string" ? input.adminNote : null,
        resolvedAt: (input?.resolvedAt instanceof Date ? input.resolvedAt : clock()).toISOString(),
      });
    },

    async userResolve(input) {
      assertRepositoryMethod(repository, "userResolve");
      const resolved = input?.resolved !== false;
      const record = await repository.userResolve({
        id: requireString(input?.id, "id"),
        userId: requireString(input?.userId, "userId"),
        resolved,
        userNote: typeof input?.userNote === "string" ? input.userNote : null,
        userResolvedAt: resolved
          ? (input?.userResolvedAt instanceof Date ? input.userResolvedAt : clock()).toISOString()
          : null,
      });
      if (notifier?.feedbackUserResolved) {
        await notifier.feedbackUserResolved(record);
      }
      return record;
    },

    async notifyUser(input) {
      assertRepositoryMethod(repository, "markUserNotified");
      const record = await repository.markUserNotified({
        id: requireString(input?.id, "id"),
        notifiedBy: typeof input?.notifiedBy === "string" ? input.notifiedBy : null,
        notifiedAt: (input?.notifiedAt instanceof Date ? input.notifiedAt : clock()).toISOString(),
      });
      if (notifier?.feedbackUserNotified) {
        await notifier.feedbackUserNotified(record);
      }
      return record;
    },
  };
}

function normalizeCreateFeedbackInput(input) {
  if (!input || typeof input !== "object") {
    throw new AppFoundryError("Feedback input is required.", "feedback.input_required");
  }

  const content = resolveFeedbackContent(input);
  if (!content) {
    throw new AppFoundryError("Feedback content is required.", "feedback.content_required");
  }

  return {
    userId: typeof input.userId === "string" || input.userId === null ? input.userId : null,
    type: normalizeFeedbackType(input.type),
    content,
    context: normalizeFeedbackContext(input.context),
    attachments: normalizeFeedbackAttachments(input.attachments),
    attachDebugLogs: input.attachDebugLogs === true,
    debugLogScopes: normalizeStringList(input.debugLogScopes),
  };
}

function buildStructuredFeedbackContent(input, options = {}) {
  const normalized = normalizeStructuredFeedbackInput(input, options);
  const headings = {
    ...DEFAULT_STRUCTURED_FEEDBACK_HEADINGS,
    ...(options.headings && typeof options.headings === "object" ? options.headings : {}),
  };
  const sections = [
    [headings.observedBehavior, normalized.observedBehavior],
    [headings.expectedBehavior, normalized.expectedBehavior],
    [headings.suspectedCause, normalized.suspectedCause],
  ];
  return sections
    .filter(([, value]) => value)
    .map(([heading, value]) => `${normalizeStructuredHeading(heading)}\n${value}`)
    .join("\n\n");
}

function normalizeStructuredFeedbackInput(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppFoundryError("Structured feedback input must be an object.", "feedback.structured_input_invalid");
  }

  const observedBehavior = structuredString(input, [
    "observedBehavior",
    "observed",
    "bugSymptom",
    "symptom",
  ]);
  const expectedBehavior = structuredString(input, [
    "expectedBehavior",
    "expected",
  ]);
  const suspectedCause = structuredString(input, [
    "suspectedCause",
    "possibleRootCause",
    "rootCause",
  ]);

  if (options.requireObservedBehavior !== false && !observedBehavior) {
    throw new AppFoundryError(
      "Structured feedback observedBehavior is required.",
      "feedback.structured_observed_required"
    );
  }

  return {
    observedBehavior,
    expectedBehavior,
    suspectedCause,
  };
}

function resolveFeedbackContent(input) {
  if (input.structuredContent != null) {
    return buildStructuredFeedbackContent(input.structuredContent, input.structuredContentOptions).trim();
  }
  return requireString(input.content, "content").trim();
}

function normalizeFeedbackType(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "other";
  const normalized = FEEDBACK_TYPE_ALIASES.get(key);
  if (!normalized) {
    throw new AppFoundryError(`Unsupported feedback type: ${String(value)}`, "feedback.type_invalid");
  }
  return normalized;
}

function normalizeFeedbackContext(context) {
  if (context == null) return {};
  if (typeof context !== "object" || Array.isArray(context)) {
    throw new AppFoundryError("Feedback context must be an object.", "feedback.context_invalid");
  }
  return redactPayload(context);
}

function normalizeFeedbackAttachments(attachments) {
  if (attachments == null) return [];
  if (!Array.isArray(attachments)) {
    throw new AppFoundryError("Feedback attachments must be an array.", "feedback.attachments_invalid");
  }
  return attachments.map(normalizeFeedbackAttachment);
}

function normalizeFeedbackAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    throw new AppFoundryError("Feedback attachment must be an object.", "feedback.attachment_invalid");
  }
  if ("data" in attachment || "base64" in attachment || "screenshotBase64" in attachment) {
    throw new AppFoundryError(
      "Feedback attachments must use object storage keys, not inline data.",
      "feedback.attachment_inline_data_forbidden"
    );
  }

  const kind = normalizeAttachmentKind(attachment.kind);
  const storageKey = requireString(attachment.storageKey, "storageKey");
  if (!isObjectKey(storageKey)) {
    throw new AppFoundryError("Feedback attachment storageKey is invalid.", "feedback.attachment_key_invalid");
  }

  const byteSize = attachment.byteSize == null ? undefined : Number(attachment.byteSize);
  if (byteSize !== undefined && (!Number.isFinite(byteSize) || byteSize < 0)) {
    throw new AppFoundryError("Feedback attachment byteSize is invalid.", "feedback.attachment_size_invalid");
  }

  return {
    id: typeof attachment.id === "string" ? attachment.id : undefined,
    kind,
    storageKey,
    contentType: typeof attachment.contentType === "string" ? attachment.contentType : "application/octet-stream",
    byteSize,
    width: positiveNumberOrUndefined(attachment.width),
    height: positiveNumberOrUndefined(attachment.height),
    createdAt: normalizeDateLike(attachment.createdAt),
  };
}

async function storeFeedbackAttachment(input) {
  if (!input || typeof input !== "object") {
    throw new AppFoundryError("Feedback attachment upload input is required.", "feedback.attachment_upload_required");
  }
  if ("data" in input || "base64" in input || "screenshotBase64" in input) {
    throw new AppFoundryError(
      "Feedback attachment uploads must pass bytes through body, not inline data fields.",
      "feedback.attachment_inline_data_forbidden"
    );
  }

  const objectStore = input.objectStore;
  if (typeof objectStore?.putObject !== "function") {
    throw new AppFoundryError("Feedback attachment upload requires objectStore.putObject.", "feedback.object_store_required");
  }

  const body = toAttachmentBody(input.body);
  const validation = validateUploadBytes({
    bytes: body,
    declaredContentType:
      typeof input.declaredContentType === "string"
        ? input.declaredContentType
        : typeof input.contentType === "string"
          ? input.contentType
          : null,
    maxBytes: input.maxBytes,
    allowedContentTypes: input.allowedContentTypes ?? DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES,
    requireDetectedContentType: input.requireDetectedContentType !== false,
  });

  if (!validation.ok) {
    throw new AppFoundryError(
      "Feedback attachment upload failed validation.",
      "feedback.attachment_upload_invalid",
      {
        errors: validation.errors,
        contentType: validation.contentType,
        byteSize: validation.byteSize,
      }
    );
  }

  const now = input.now instanceof Date ? input.now : new Date();
  const contentType = validation.contentType;
  const storageKey = normalizeAttachmentStorageKey(input, contentType, now);
  const stored = await objectStore.putObject({
    key: storageKey,
    body,
    contentType,
    cacheControl: typeof input.cacheControl === "string" ? input.cacheControl : undefined,
    metadata: input.metadata,
  });
  const storedObject = {
    key: typeof stored?.key === "string" ? stored.key : storageKey,
    contentType: typeof stored?.contentType === "string" ? stored.contentType : contentType,
    byteSize: typeof stored?.byteSize === "number" ? stored.byteSize : body.byteLength,
    url: typeof stored?.url === "string" ? stored.url : undefined,
  };

  return {
    attachment: normalizeFeedbackAttachment({
      id: typeof input.id === "string" ? input.id : undefined,
      kind: input.kind,
      storageKey: storedObject.key,
      contentType: storedObject.contentType,
      byteSize: storedObject.byteSize,
      width: input.width,
      height: input.height,
      createdAt: input.createdAt ?? now,
    }),
    storedObject,
    validation,
  };
}

function normalizeAttachmentKind(value) {
  const kind = typeof value === "string" ? value.trim().toLowerCase() : "other";
  if (!FEEDBACK_ATTACHMENT_KINDS.includes(kind)) {
    throw new AppFoundryError(`Unsupported feedback attachment kind: ${String(value)}`, "feedback.attachment_kind_invalid");
  }
  return kind;
}

function normalizeAttachmentStorageKey(input, contentType, now) {
  if (typeof input.storageKey === "string") {
    if (!isObjectKey(input.storageKey)) {
      throw new AppFoundryError("Feedback attachment storageKey is invalid.", "feedback.attachment_key_invalid");
    }
    return input.storageKey;
  }
  return createObjectKey({
    purpose: typeof input.purpose === "string" ? input.purpose : "feedback",
    ids: Array.isArray(input.ids) ? input.ids : [],
    contentType,
    now,
    randomId: input.randomId,
  });
}

function toAttachmentBody(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new AppFoundryError("Feedback attachment body must be a Uint8Array.", "feedback.attachment_body_invalid");
}

async function buildDebugSnapshot({
  debugLogRepository,
  input,
  now,
  snapshotWindowMinutes,
  snapshotMaxEvents,
}) {
  if (!debugLogRepository?.findSnapshot) {
    return {
      attached: false,
      eventCount: 0,
      reason: "debug_log_repository_missing",
      scopes: input.debugLogScopes,
    };
  }

  const since = new Date(now.getTime() - snapshotWindowMinutes * 60 * 1000);
  const events = await debugLogRepository.findSnapshot({
    userId: input.userId,
    since,
    until: now,
    scopes: input.debugLogScopes,
    limit: snapshotMaxEvents,
  });

  return createDebugSnapshot(Array.isArray(events) ? events : [], {
    since,
    until: now,
    scopes: input.debugLogScopes,
    maxEvents: snapshotMaxEvents,
  });
}

function normalizeUserFeedbackQuery(query) {
  return {
    userId: requireString(query?.userId, "userId"),
    status: typeof query?.status === "string" ? query.status : undefined,
    limit: limitOrDefault(query?.limit, 50),
    cursor: typeof query?.cursor === "string" ? query.cursor : undefined,
  };
}

function normalizeAdminFeedbackQuery(query) {
  return {
    status: typeof query?.status === "string" ? query.status : undefined,
    type: query?.type == null ? undefined : normalizeFeedbackType(query.type),
    userId: typeof query?.userId === "string" ? query.userId : undefined,
    changedSince: dateLikeOrUndefined(query?.changedSince),
    createdSince: dateLikeOrUndefined(query?.createdSince),
    resolved: typeof query?.resolved === "boolean" ? query.resolved : undefined,
    seen: typeof query?.seen === "boolean" ? query.seen : undefined,
    limit: limitOrDefault(query?.limit, 50, 500),
    cursor: typeof query?.cursor === "string" ? query.cursor : undefined,
  };
}

function requireString(value, fieldName) {
  if (typeof value !== "string") {
    throw new AppFoundryError(`${fieldName} must be a string.`, `${fieldName}.invalid`);
  }
  return value;
}

function structuredString(input, keys) {
  for (const key of keys) {
    if (typeof input[key] === "string") {
      const trimmed = input[key].trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function normalizeStructuredHeading(value) {
  if (typeof value !== "string") return "";
  const heading = value.trim();
  if (!heading) {
    throw new AppFoundryError("Structured feedback heading is required.", "feedback.structured_heading_required");
  }
  return heading;
}

function normalizeIdList(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new AppFoundryError(`${fieldName} must be a non-empty string array.`, `${fieldName}.invalid`);
  }
  const ids = [];
  const seen = new Set();
  for (const item of value) {
    const id = requireString(item, fieldName).trim();
    if (!id) {
      throw new AppFoundryError(`${fieldName} must not contain blank ids.`, `${fieldName}.invalid`);
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  if (ids.length === 0) {
    throw new AppFoundryError(`${fieldName} must be a non-empty string array.`, `${fieldName}.invalid`);
  }
  return ids;
}

function assertRepositoryMethod(repository, method) {
  if (typeof repository[method] !== "function") {
    throw new AppFoundryError(`FeedbackRepository.${method} is required.`, `feedback.repository_${method}_required`);
  }
}

function positiveNumberOrUndefined(value) {
  if (value == null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function limitOrDefault(value, fallback, max = 200) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

function normalizeDateLike(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

function dateLikeOrUndefined(value) {
  if (value == null) return undefined;
  const normalized = normalizeDateLike(value);
  if (normalized) return normalized;
  throw new AppFoundryError("Feedback query timestamp is invalid.", "feedback.query_timestamp_invalid");
}

module.exports = {
  FEEDBACK_TYPES,
  FEEDBACK_ATTACHMENT_KINDS,
  DEFAULT_DEBUG_SNAPSHOT_WINDOW_MINUTES,
  DEFAULT_DEBUG_SNAPSHOT_MAX_EVENTS,
  DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES,
  STRUCTURED_FEEDBACK_FIELDS,
  DEFAULT_STRUCTURED_FEEDBACK_HEADINGS,
  createFeedbackService,
  normalizeCreateFeedbackInput,
  buildStructuredFeedbackContent,
  normalizeStructuredFeedbackInput,
  normalizeFeedbackType,
  normalizeFeedbackContext,
  normalizeFeedbackAttachments,
  normalizeFeedbackAttachment,
  storeFeedbackAttachment,
};
