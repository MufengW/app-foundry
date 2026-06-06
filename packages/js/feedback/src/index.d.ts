import type { DebugEvent, DebugSnapshot } from "@app-foundry/debug";
import type { PutObjectInput, StoredObject, ValidateUploadResult } from "@app-foundry/media";

export declare const FEEDBACK_TYPES: readonly ["bug", "feature", "other"];
export declare const FEEDBACK_ATTACHMENT_KINDS: readonly [
  "screenshot",
  "annotated_screenshot",
  "photo",
  "log_archive",
  "other"
];
export declare const DEFAULT_DEBUG_SNAPSHOT_WINDOW_MINUTES: number;
export declare const DEFAULT_DEBUG_SNAPSHOT_MAX_EVENTS: number;
export declare const DEFAULT_FEEDBACK_ATTACHMENT_CONTENT_TYPES: readonly [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
];
export declare const FEEDBACK_ATTACHMENT_STATUS_ERRORS: readonly [
  "validation_failed",
  "upload_failed",
  "storage_unavailable",
  "not_provided",
  "unknown"
];
export declare const STRUCTURED_FEEDBACK_FIELDS: readonly [
  "observedBehavior",
  "expectedBehavior",
  "suspectedCause"
];
export declare const DEFAULT_STRUCTURED_FEEDBACK_HEADINGS: Readonly<{
  observedBehavior: "Observed behavior";
  expectedBehavior: "Expected behavior";
  suspectedCause: "Suspected cause";
}>;

export type FeedbackType = "bug" | "feature" | "other";
export type FeedbackAttachmentKind =
  | "screenshot"
  | "annotated_screenshot"
  | "photo"
  | "log_archive"
  | "other";

export interface FeedbackContext {
  platform?: string;
  appVersion?: string;
  appBuild?: string;
  deviceModel?: string;
  osVersion?: string;
  [key: string]: unknown;
}

export interface FeedbackAttachmentInput {
  id?: string;
  kind?: FeedbackAttachmentKind;
  storageKey: string;
  contentType?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  createdAt?: Date | string;
}

export interface FeedbackAttachmentRecord extends FeedbackAttachmentInput {
  kind: FeedbackAttachmentKind;
  contentType: string;
}

export type FeedbackAttachmentStatusError =
  | "validation_failed"
  | "upload_failed"
  | "storage_unavailable"
  | "not_provided"
  | "unknown";

export type FeedbackAttachmentStatus =
  | { attached: true }
  | { attached: false; error: FeedbackAttachmentStatusError };

export interface FeedbackAttachmentObjectStore {
  putObject(input: PutObjectInput): Promise<StoredObject>;
}

export interface StoreFeedbackAttachmentInput {
  objectStore: FeedbackAttachmentObjectStore;
  body: Uint8Array | ArrayBuffer | ArrayBufferView;
  declaredContentType?: string | null;
  contentType?: string | null;
  kind?: FeedbackAttachmentKind;
  storageKey?: string;
  purpose?: string;
  ids?: string[];
  randomId?: string;
  id?: string;
  width?: number;
  height?: number;
  createdAt?: Date | string;
  now?: Date;
  maxBytes?: number;
  allowedContentTypes?: string[];
  requireDetectedContentType?: boolean;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface StoreFeedbackAttachmentResult {
  attachment: FeedbackAttachmentRecord;
  storedObject: StoredObject;
  validation: ValidateUploadResult;
}

export interface StructuredFeedbackContentInput {
  observedBehavior?: string;
  observed?: string;
  bugSymptom?: string;
  symptom?: string;
  expectedBehavior?: string;
  expected?: string;
  suspectedCause?: string;
  possibleRootCause?: string;
  rootCause?: string;
}

export interface StructuredFeedbackContent {
  observedBehavior: string;
  expectedBehavior: string;
  suspectedCause: string;
}

export interface StructuredFeedbackContentOptions {
  requireObservedBehavior?: boolean;
  headings?: Partial<Record<"observedBehavior" | "expectedBehavior" | "suspectedCause", string>>;
}

export interface CreateFeedbackInput {
  userId?: string | null;
  type?: FeedbackType | string;
  content?: string;
  structuredContent?: StructuredFeedbackContentInput;
  structuredContentOptions?: StructuredFeedbackContentOptions;
  context?: FeedbackContext;
  attachments?: FeedbackAttachmentInput[];
  attachDebugLogs?: boolean;
  debugLogScopes?: string[];
}

export interface CreateFeedbackRecordInput {
  userId?: string | null;
  type: FeedbackType;
  content: string;
  context: FeedbackContext;
  attachments: FeedbackAttachmentRecord[];
  debugSnapshot: DebugSnapshot | { attached: false; eventCount: 0; reason: string; scopes: string[] } | null;
  createdAt: string;
}

export interface FeedbackRecord {
  id: string;
  userId?: string | null;
  type: FeedbackType;
  content: string;
  context?: FeedbackContext;
  attachments?: FeedbackAttachmentRecord[];
  debugSnapshot?: unknown;
  status?: string;
  seenAt?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  adminNote?: string | null;
  userResolvedAt?: string | null;
  userNote?: string | null;
  notifiedAt?: string | null;
  notifiedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFeedbackResult {
  feedback: FeedbackRecord;
  debugSnapshot: CreateFeedbackRecordInput["debugSnapshot"];
}

export interface UserFeedbackQuery {
  userId: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

export interface AdminFeedbackQuery {
  status?: string;
  type?: FeedbackType | string;
  userId?: string;
  changedSince?: Date | string;
  createdSince?: Date | string;
  resolved?: boolean;
  seen?: boolean;
  limit?: number;
  cursor?: string;
}

export interface FeedbackRecordPage {
  items: FeedbackRecord[];
  nextCursor?: string | null;
}

export interface MarkFeedbackSeenInput {
  id: string;
  seenBy?: string | null;
  seenAt?: Date;
}

export interface MarkFeedbackSeenManyInput {
  ids?: string[];
  all?: boolean;
  seenBy?: string | null;
  seenAt?: Date;
}

export interface ResolveFeedbackInput {
  id: string;
  resolvedBy?: string | null;
  adminNote?: string | null;
  resolvedAt?: Date;
}

export interface ResolveFeedbackManyInput {
  ids: string[];
  resolvedBy?: string | null;
  adminNote?: string | null;
  resolvedAt?: Date;
}

export interface UserResolveFeedbackInput {
  id: string;
  userId: string;
  resolved?: boolean;
  userNote?: string | null;
  userResolvedAt?: Date;
}

export interface NotifyFeedbackUserInput {
  id: string;
  notifiedBy?: string | null;
  notifiedAt?: Date;
}

export interface DebugSnapshotQuery {
  userId?: string | null;
  since: Date;
  until: Date;
  scopes: string[];
  limit: number;
}

export interface DebugLogRepository {
  findSnapshot(query: DebugSnapshotQuery): Promise<Array<Partial<DebugEvent>>>;
}

export interface FeedbackBulkMutationResult {
  count: number;
}

export interface FeedbackRepository {
  create?(input: CreateFeedbackRecordInput): Promise<FeedbackRecord>;
  listForUser?(query: UserFeedbackQuery): Promise<FeedbackRecord[]>;
  listForAdmin?(query: AdminFeedbackQuery): Promise<FeedbackRecordPage>;
  markSeen?(input: MarkFeedbackSeenInput & { seenAt: string }): Promise<void>;
  markSeenMany?(input: Omit<MarkFeedbackSeenManyInput, "seenAt"> & { ids: string[]; all: boolean; seenAt: string }): Promise<FeedbackBulkMutationResult>;
  resolve?(input: ResolveFeedbackInput & { resolvedAt: string }): Promise<FeedbackRecord>;
  resolveMany?(input: ResolveFeedbackManyInput & { resolvedAt: string }): Promise<FeedbackBulkMutationResult>;
  userResolve?(input: Omit<UserResolveFeedbackInput, "userResolvedAt"> & { userResolvedAt: string | null }): Promise<FeedbackRecord>;
  markUserNotified?(input: NotifyFeedbackUserInput & { notifiedAt: string }): Promise<FeedbackRecord>;
}

export interface FeedbackNotifier {
  feedbackCreated?(record: FeedbackRecord): Promise<void> | void;
  feedbackResolved?(record: FeedbackRecord): Promise<void> | void;
  feedbackUserResolved?(record: FeedbackRecord): Promise<void> | void;
  feedbackUserNotified?(record: FeedbackRecord): Promise<void> | void;
}

export interface CreateFeedbackServiceOptions {
  repository: FeedbackRepository;
  debugLogRepository?: DebugLogRepository;
  notifier?: FeedbackNotifier;
  clock?: () => Date;
  debugSnapshotWindowMinutes?: number;
  debugSnapshotMaxEvents?: number;
}

export interface FeedbackService {
  create(input: CreateFeedbackInput): Promise<CreateFeedbackResult>;
  listForUser(query: UserFeedbackQuery): Promise<FeedbackRecord[]>;
  listForAdmin(query?: AdminFeedbackQuery): Promise<FeedbackRecordPage>;
  markSeen(input: MarkFeedbackSeenInput): Promise<void>;
  markSeenMany(input: MarkFeedbackSeenManyInput): Promise<FeedbackBulkMutationResult>;
  resolve(input: ResolveFeedbackInput): Promise<FeedbackRecord>;
  resolveMany(input: ResolveFeedbackManyInput): Promise<FeedbackBulkMutationResult>;
  userResolve(input: UserResolveFeedbackInput): Promise<FeedbackRecord>;
  notifyUser(input: NotifyFeedbackUserInput): Promise<FeedbackRecord>;
}

export declare function createFeedbackService(options: CreateFeedbackServiceOptions): FeedbackService;
export declare function normalizeCreateFeedbackInput(input: CreateFeedbackInput): CreateFeedbackRecordInput;
export declare function buildStructuredFeedbackContent(input: StructuredFeedbackContentInput, options?: StructuredFeedbackContentOptions): string;
export declare function normalizeStructuredFeedbackInput(input: StructuredFeedbackContentInput, options?: StructuredFeedbackContentOptions): StructuredFeedbackContent;
export declare function normalizeFeedbackType(value: unknown): FeedbackType;
export declare function normalizeFeedbackContext(context: unknown): FeedbackContext;
export declare function normalizeFeedbackAttachments(attachments: unknown): FeedbackAttachmentRecord[];
export declare function normalizeFeedbackAttachment(attachment: unknown): FeedbackAttachmentRecord;
export declare function normalizeFeedbackAttachmentStatus(status: unknown): FeedbackAttachmentStatus;
export declare function normalizeFeedbackAttachmentStatusError(value: unknown): FeedbackAttachmentStatusError;
export declare function storeFeedbackAttachment(input: StoreFeedbackAttachmentInput): Promise<StoreFeedbackAttachmentResult>;
