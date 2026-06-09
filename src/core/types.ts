export type TriggerType = "interval" | "event" | "goal";

export interface LoopSpec {
  name: string;
  goal: string;
  trigger: {
    type: TriggerType;
    every?: string;
    source?: string;
    expires?: string;
    until?: string;
  };
  runner: RunnerSpec;
  context?: ContextSpec;
  tools?: ToolPolicySpec;
  verifier?: VerifierSpec;
  budget?: BudgetSpec;
  stop?: StopSpec;
  rollback?: RollbackSpec;
  evolution?: EvolutionSpec;
}

export interface RunnerSpec {
  type: "dry-run" | "custom" | "opencode" | "openharness";
  command?: string;
  timeout?: string;
}

export interface ContextSpec {
  include?: string[];
  max_tokens?: number;
}

export interface ToolPolicySpec {
  allow?: string[];
  ask?: string[];
  deny?: string[];
}

export interface VerifierSpec {
  strategy?: "composite" | "independent_agent";
  checks?: VerifierCheckSpec[];
}

export type VerifierCheckSpec =
  | { type: "always_pass"; name?: string }
  | { type: "runner_exit_zero"; name?: string }
  | { type: "command"; name?: string; command: string; timeout?: string }
  | { type: "tests_passed"; name?: string; command: string; timeout?: string }
  | { type: "file_exists"; name?: string; path: string }
  | { type: "diff_scope"; name?: string; max_files_changed: number }
  | { type: "no_secret_access"; name?: string; patterns?: string[] }
  | { type: "human_required"; name?: string; reason?: string };

export interface BudgetSpec {
  max_cost_usd?: number;
  max_iterations?: number;
  max_tokens?: number;
  max_runtime?: string;
  min_interval?: string;
  stop_on_repeated_failure?: number;
  require_human_after_cost_usd?: number;
}

export interface StopSpec {
  max_iterations?: number;
  max_runtime?: string;
  max_cost_usd?: number;
  repeated_failure?: number;
  no_progress?: number;
}

export interface RollbackSpec {
  strategy?: "none" | "git_worktree";
  commit_on_verified?: boolean;
  rollback_on_failed_verifier?: boolean;
  preserve_artifacts?: boolean;
}

export interface EvolutionSpec {
  enabled?: boolean;
  propose_updates_to?: string[];
}

export interface LoopInput {
  reason?: string;
  payload?: unknown;
}

export interface LoopState {
  loopId: string;
  name: string;
  goal: string;
  cwd: string;
  startedAt: string;
  updatedAt: string;
  iterations: IterationRecord[];
  totals: {
    costUsd: number;
    tokens: number;
  };
  status: "running" | "stopped" | "failed";
  stopReason?: StopReason;
}

export interface IterationRecord {
  index: number;
  startedAt: string;
  finishedAt?: string;
  contextFile?: string;
  snapshotPatchFile?: string;
  plan?: RunnerPlan;
  execution?: RunnerExecution;
  feedback?: Feedback;
  verification?: VerificationResult;
  rollback?: RollbackResult;
}

export interface RunnerPlan {
  summary: string;
  command?: string;
}

export interface RunnerExecution {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  costUsd: number;
  tokens: number;
}

export interface Feedback {
  runnerExitCode: number | null;
  outputSummary: string;
  costUsd: number;
  tokens: number;
}

export interface VerificationResult {
  passed: boolean;
  checks: CheckResult[];
}

export interface CheckResult {
  name: string;
  type: string;
  passed: boolean;
  message: string;
}

export interface RollbackResult {
  attempted: boolean;
  succeeded: boolean;
  reason: string;
}

export type StopReason =
  | "goal_completed"
  | "max_iterations"
  | "max_cost"
  | "max_runtime"
  | "repeated_failure"
  | "no_progress"
  | "unsafe_action"
  | "human_required"
  | "external_blocker"
  | "once";

export interface StopDecision {
  shouldStop: boolean;
  reason?: StopReason;
  message?: string;
}
