import { z } from "zod";
import type { LoopSpec } from "./types.js";

const durationPattern = /^\d+(ms|s|m|h|d)$/;

const verifierCheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always_pass"), name: z.string().optional() }),
  z.object({ type: z.literal("runner_exit_zero"), name: z.string().optional() }),
  z.object({
    type: z.literal("command"),
    name: z.string().optional(),
    command: z.string().min(1),
    timeout: z.string().regex(durationPattern).optional()
  }),
  z.object({
    type: z.literal("tests_passed"),
    name: z.string().optional(),
    command: z.string().min(1),
    timeout: z.string().regex(durationPattern).optional()
  }),
  z.object({ type: z.literal("file_exists"), name: z.string().optional(), path: z.string().min(1) }),
  z.object({
    type: z.literal("diff_scope"),
    name: z.string().optional(),
    max_files_changed: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("no_secret_access"),
    name: z.string().optional(),
    patterns: z.array(z.string()).optional()
  }),
  z.object({ type: z.literal("human_required"), name: z.string().optional(), reason: z.string().optional() })
]);

export const loopSpecSchema: z.ZodType<LoopSpec> = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/),
  goal: z.string().min(1),
  trigger: z.object({
    type: z.enum(["interval", "event", "goal"]),
    every: z.string().regex(durationPattern).optional(),
    source: z.string().optional(),
    expires: z.string().regex(durationPattern).optional(),
    until: z.string().optional()
  }),
  runner: z.object({
    type: z.enum(["dry-run", "custom", "opencode", "openharness"]),
    command: z.string().optional(),
    timeout: z.string().regex(durationPattern).optional()
  }),
  context: z
    .object({
      include: z.array(z.string()).optional(),
      max_tokens: z.number().int().positive().optional()
    })
    .optional(),
  tools: z
    .object({
      allow: z.array(z.string()).optional(),
      ask: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional()
    })
    .optional(),
  verifier: z
    .object({
      strategy: z.enum(["composite", "independent_agent"]).optional(),
      checks: z.array(verifierCheckSchema).optional()
    })
    .optional(),
  budget: z
    .object({
      max_cost_usd: z.number().nonnegative().optional(),
      max_iterations: z.number().int().positive().optional(),
      max_tokens: z.number().int().positive().optional(),
      max_runtime: z.string().regex(durationPattern).optional(),
      min_interval: z.string().regex(durationPattern).optional(),
      stop_on_repeated_failure: z.number().int().positive().optional(),
      require_human_after_cost_usd: z.number().nonnegative().optional()
    })
    .optional(),
  stop: z
    .object({
      max_iterations: z.number().int().positive().optional(),
      max_runtime: z.string().regex(durationPattern).optional(),
      max_cost_usd: z.number().nonnegative().optional(),
      repeated_failure: z.number().int().positive().optional(),
      no_progress: z.number().int().positive().optional()
    })
    .optional(),
  rollback: z
    .object({
      strategy: z.enum(["none", "git_worktree"]).optional(),
      commit_on_verified: z.boolean().optional(),
      rollback_on_failed_verifier: z.boolean().optional(),
      preserve_artifacts: z.boolean().optional()
    })
    .optional(),
  evolution: z
    .object({
      enabled: z.boolean().optional(),
      propose_updates_to: z.array(z.string()).optional()
    })
    .optional()
});

export function validateLoopSpec(value: unknown): LoopSpec {
  return loopSpecSchema.parse(value);
}
