export declare const REDACTION_POLICY_VERSION = "appfoundry.redaction.v0";

export type DebugSource = "ios" | "android" | "web" | "backend" | "ai" | "worker" | string;
export type DebugPlatform = "ios" | "android" | "web" | "server" | string;
export type DebugLevel = "debug" | "info" | "warn" | "error" | string;

export interface RedactedBase64 {
  __redacted: "base64";
  bytes: number;
  sha256: string;
}

export interface RedactedSecret {
  __redacted: "secret";
}

export interface RedactionOptions {
  base64Keys?: Iterable<string>;
  base64ArrayKeys?: Iterable<string>;
  secretKeys?: Iterable<string>;
}

export interface DebugEvent {
  id?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string | null;
  source: DebugSource;
  platform?: DebugPlatform;
  level?: DebugLevel;
  eventType: string;
  screen?: string;
  endpoint?: string;
  debugPrefix?: string;
  tags?: string[];
  message?: string;
  payload?: unknown;
  occurredAt: string | Date;
}

export interface SanitizedDebugEvent extends Omit<DebugEvent, "occurredAt"> {
  occurredAt: string;
  redactionPolicyVersion: typeof REDACTION_POLICY_VERSION;
}

export interface SanitizeDebugOptions {
  maxEvents?: number;
  maxPayloadBytes?: number;
  redaction?: RedactionOptions;
}

export interface DebugSnapshotOptions extends SanitizeDebugOptions {
  now?: Date;
  since?: Date;
  until?: Date;
  windowMinutes?: number;
  scopes?: string[];
}

export interface DebugSnapshot {
  attached: true;
  eventCount: number;
  windowStartedAt: string;
  windowEndedAt: string;
  scopes: string[];
  redactionPolicyVersion: typeof REDACTION_POLICY_VERSION;
  events: SanitizedDebugEvent[];
}

export declare function redactPayload(value: unknown, options?: RedactionOptions): unknown;
export declare function sanitizeDebugPrefix(value: unknown): string | null;
export declare function safePayload(value: unknown, maxBytes?: number, options?: RedactionOptions): unknown;
export declare function sanitizeDebugEvent(event: Partial<DebugEvent>, options?: SanitizeDebugOptions): SanitizedDebugEvent;
export declare function sanitizeDebugEvents(events: unknown[], options?: SanitizeDebugOptions): SanitizedDebugEvent[];
export declare function matchesDebugScopes(event: Partial<DebugEvent>, scopes?: string[]): boolean;
export declare function createDebugSnapshot(events: Array<Partial<DebugEvent>>, options?: DebugSnapshotOptions): DebugSnapshot;
