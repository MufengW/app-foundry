import type {
  ObjectStore,
  PutObjectInput,
  SignReadUrlInput,
  SignedUrl,
  StoredObject,
} from "@app-foundry/media";

export declare const DEFAULT_SIGNED_READ_URL_EXPIRES_IN_SECONDS: number;

export interface S3CommandConstructors {
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
}

export interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}

export interface S3ClientObjectStoreOptions {
  bucket: string;
  client: S3ClientLike;
  commands: S3CommandConstructors;
  getSignedUrl?: (client: S3ClientLike, command: unknown, options: { expiresIn: number }) => Promise<string> | string;
  presignReadUrl?: (input: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
    command: unknown;
    client: S3ClientLike;
  }) => Promise<string> | string;
  defaultExpiresInSeconds?: number;
  clock?: () => Date;
}

export interface DirectObjectStoreOptions {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getSignedReadUrl(input: SignReadUrlInput): Promise<SignedUrl>;
}

export type S3ObjectStoreOptions = S3ClientObjectStoreOptions | DirectObjectStoreOptions;

export declare function createS3ObjectStore(options: S3ObjectStoreOptions): ObjectStore;
export declare function toS3PutObjectInput(bucket: string, input: PutObjectInput): Record<string, unknown>;
export declare function toS3DeleteObjectInput(bucket: string, key: string): Record<string, unknown>;
export declare function toS3GetObjectInput(bucket: string, key: string): Record<string, unknown>;
