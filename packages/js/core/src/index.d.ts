export declare const DEFAULT_DEBUG_PAYLOAD_MAX_BYTES: number;

export declare class AppFoundryError extends Error {
  code: string;
  details?: unknown;
  constructor(message: string, code: string, details?: unknown);
}

export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function byteLengthUtf8(value: string): number;
export declare function truncateJsonValue(value: unknown, maxBytes?: number): unknown;
export declare function normalizeStringList(values: unknown): string[];
