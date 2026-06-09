import type { BuiltContext } from "../context/context_builder.js";
import { parseDuration } from "../core/duration.js";
import type { LoopPaths } from "../core/paths.js";
import type { LoopSpec, LoopState, RunnerExecution, RunnerPlan } from "../core/types.js";
import { runShell, summarizeOutput } from "../io/shell.js";

export interface RunnerResult {
  plan: RunnerPlan;
  execution: RunnerExecution;
}

export class AgentRunner {
  async run(spec: LoopSpec, state: LoopState, context: BuiltContext, paths: LoopPaths): Promise<RunnerResult> {
    const startedAt = new Date().toISOString();

    if (spec.runner.type === "dry-run") {
      const finishedAt = new Date().toISOString();
      return {
        plan: {
          summary: "Dry-run runner recorded context and skipped external agent execution."
        },
        execution: {
          ok: true,
          exitCode: 0,
          stdout: `Dry run completed for ${spec.name}. Context: ${context.filePath}`,
          stderr: "",
          startedAt,
          finishedAt,
          costUsd: 0,
          tokens: context.tokenEstimate
        }
      };
    }

    const command = this.resolveCommand(spec);
    const timeoutMs = parseDuration(spec.runner.timeout, 30 * 60_000);
    const result = await runShell(command, {
      cwd: state.cwd,
      timeoutMs,
      env: {
        LOOPFORGE_LOOP_NAME: spec.name,
        LOOPFORGE_GOAL: spec.goal,
        LOOPFORGE_CONTEXT_FILE: context.filePath,
        LOOPFORGE_STATE_FILE: paths.stateFile,
        LOOPFORGE_ITERATION: String(state.iterations.length + 1)
      }
    });
    const finishedAt = new Date().toISOString();
    const costUsd = parseReportedCost(result.stdout);
    const tokens = context.tokenEstimate + Math.ceil((result.stdout.length + result.stderr.length) / 4);

    return {
      plan: {
        summary: `Run ${spec.runner.type} command.`,
        command
      },
      execution: {
        ok: result.exitCode === 0 && !result.timedOut,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.timedOut ? `${result.stderr}\nCommand timed out.` : result.stderr,
        startedAt,
        finishedAt,
        costUsd,
        tokens
      }
    };
  }

  private resolveCommand(spec: LoopSpec): string {
    if (spec.runner.command) return spec.runner.command;
    if (spec.runner.type === "opencode") return "opencode run";
    if (spec.runner.type === "openharness") return "oh run";
    throw new Error(`Runner ${spec.runner.type} requires a command.`);
  }
}

export function buildFeedback(execution: RunnerExecution) {
  return {
    runnerExitCode: execution.exitCode,
    outputSummary: summarizeOutput(execution.stdout, execution.stderr),
    costUsd: execution.costUsd,
    tokens: execution.tokens
  };
}

function parseReportedCost(stdout: string): number {
  const match = stdout.match(/loopforge:cost=([0-9]+(?:\.[0-9]+)?)/i);
  return match ? Number(match[1]) : 0;
}
