export declare const DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES: string[];
export declare const DEFAULT_ALLOWED_MEDIA_EXTENSIONS: string[];
export declare const IMAGE_UPLOAD_CONTENT_TYPES: string[];
export declare const VIDEO_UPLOAD_CONTENT_TYPES: string[];
export declare const AUDIO_UPLOAD_CONTENT_TYPES: string[];
export declare const DEFAULT_EXTENSION_BY_CONTENT_TYPE: Record<string, string>;

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  contentType: string;
  byteSize?: number;
  url?: string;
}

export interface SignReadUrlInput {
  key: string;
  expiresInSeconds?: number;
}

export interface SignedUrl {
  url: string;
  expiresAt?: string;
}

export interface ObjectStore {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getSignedReadUrl(input: SignReadUrlInput): Promise<SignedUrl>;
}

export interface ObjectKeyOptions {
  maxLength?: number;
  allowedExtensions?: string[];
  strictLegacyR2Key?: boolean;
  legacyUploadPrefix?: string;
  allowedOrigins?: string[];
  allowedBaseUrls?: string[];
}

export interface CreateObjectKeyInput {
  purpose?: string;
  extension?: string;
  contentType?: string;
  ids?: string[];
  now?: Date;
  randomId?: string;
}

export interface ValidateUploadInput {
  declaredContentType?: string | null;
  detectedContentType?: string | null;
  byteSize?: number | null;
  maxBytes?: number;
  allowedContentTypes?: string[];
  requireDetectedContentType?: boolean;
}

export interface ValidateUploadResult {
  ok: boolean;
  errors: string[];
  contentType: string | null;
  byteSize: number | null;
}

export interface ValidateUploadBytesInput extends Omit<ValidateUploadInput, "detectedContentType" | "byteSize"> {
  bytes?: Uint8Array | ArrayBuffer | null;
  defaultDeclaredContentType?: string | null;
  inferDeclaredContentType?: boolean;
  preferDeclaredContentType?: boolean;
  extensionByContentType?: Record<string, string>;
}

export interface ValidateBase64UploadInput extends Omit<ValidateUploadBytesInput, "bytes"> {
  data?: string | null;
  allowDataUri?: boolean;
}

export interface ValidatedUploadBytesResult extends ValidateUploadResult {
  declaredContentType: string | null;
  detectedContentType: string | null;
  extension: string | null;
  bytes: Uint8Array | null;
}

export declare function isObjectKey(value: unknown, options?: ObjectKeyOptions): boolean;
export declare function extractObjectKey(value: unknown, options?: ObjectKeyOptions): string | null;
export declare function createObjectKey(input?: CreateObjectKeyInput): string;
export declare function validateUpload(input?: ValidateUploadInput): ValidateUploadResult;
export declare function validateUploadBytes(input?: ValidateUploadBytesInput): ValidatedUploadBytesResult;
export declare function validateBase64Upload(input?: ValidateBase64UploadInput): ValidatedUploadBytesResult;
export declare function detectUploadContentType(bytes: unknown): string | null;
export declare function extensionForContentType(
  contentType: string | null | undefined,
  extensionByContentType?: Record<string, string>
): string | null;
