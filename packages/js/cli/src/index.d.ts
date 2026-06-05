export const CLI_VERSION: "0.0.0";

export interface DoctorCheck {
  code: string;
  ok: boolean;
  message: string;
}

export interface DoctorResult {
  ok: boolean;
  root: string;
  checks: DoctorCheck[];
}

export interface PrivacyFinding {
  code: string;
  severity: "medium" | "high" | "critical";
  message: string;
  path: string;
  line: number;
}

export interface PrivacyAuditResult {
  ok: boolean;
  root: string;
  scannedFiles: number;
  findings: PrivacyFinding[];
}

export function doctorProject(options?: { root?: string }): Promise<DoctorResult>;

export function auditPrivacy(options?: {
  root?: string;
  maxFileBytes?: number;
}): Promise<PrivacyAuditResult>;

export function feedbackDryRunChecklist(): string[];

export function runAppFoundryCli(
  argv?: string[],
  io?: {
    cwd?: string;
    stdout?: { write(value: string): void };
    stderr?: { write(value: string): void };
  }
): Promise<number>;
