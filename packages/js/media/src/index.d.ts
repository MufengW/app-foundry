export declare const DEFAULT_ALLOWED_MEDIA_CONTENT_TYPES: string[];
export declare const DEFAULT_ALLOWED_MEDIA_EXTENSIONS: string[];

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

export declare function isObjectKey(value: unknown, options?: ObjectKeyOptions): boolean;
export declare function extractObjectKey(value: unknown, options?: ObjectKeyOptions): string | null;
export declare function createObjectKey(input?: CreateObjectKeyInput): string;
export declare function validateUpload(input?: ValidateUploadInput): ValidateUploadResult;
export declare function detectUploadContentType(bytes: unknown): string | null;
