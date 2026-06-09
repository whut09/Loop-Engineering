import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { AgentRunner, buildFeedback } from "../agent/runner.js";
import { ContextBuilder } from "../context/context_builder.js";
import { applyExecutionBudget } from "../governance/budget.js";
import { guardRunnerCommand } from "../governance/permissions.js";
import { RollbackManager } from "../governance/rollback.js";
import { StopPolicy } from "../governance/stop_policy.js";
import { Scheduler } from "../scheduler/scheduler.js";
import { TraceStore } from "../trace/trace_store.js";
import { Verifier } from "../verifier/verifier.js";
import { getLoopPaths } from "./paths.js";
import { loadOrCreateState, saveState } from "./state.js";
import type { IterationRecord, LoopInput, LoopSpec, LoopState } from "./types.js";

export interface RunLoopOptions {
  cwd: string;
  once?: boolean;
  input?: LoopInput;
  maxIterationsOverride?: number;
}

export interface RunLoopResult {
  state: LoopState;
  traceFile: string;
  stateFile: string;
}

export async function runLoop(spec: LoopSpec, options: RunLoopOptions): Promise<RunLoopResult> {
  const cwd = path.resolve(options.cwd);
  const paths = getLoopPaths(cwd, spec);
  await mkdir(paths.loopDir, { recursive: true });

  const trace = new TraceStore(paths.traceFile);
  const contextBuilder = new ContextBuilder(paths);
  const runner = new AgentRunner();
  const verifier = new Verifier();
  const stopPolicy = new StopPolicy();
  const scheduler = new Scheduler();
  const rollback = new RollbackManager();
  const state = await loadOrCreateState(spec, cwd, paths);

  await trace.record("loop.started", {
    loopId: state.loopId,
    name: spec.name,
    reason: options.input?.reason,
    once: Boolean(options.once)
  });

  const commandDecision = guardRunnerCommand(spec);
  if (!commandDecision.allowed) {
    state.status = "stopped";
    state.stopReason = "unsafe_action";
    await saveState(paths, state);
    await trace.record("loop.stopped", commandDecision);
    return { state, traceFile: paths.traceFile, stateFile: paths.stateFile };
  }

  while (true) {
    if (options.maxIterationsOverride && state.iterations.length >= options.maxIterationsOverride) {
      state.status = "stopped";
      state.stopReason = "max_iterations";
      await trace.record("loop.stopped", { reason: "max_iterations", source: "cli_override" });
      break;
    }

    const beforeStop = stopPolicy.checkBeforeIteration(spec, state);
    if (beforeStop.shouldStop) {
      state.status = "stopped";
      state.stopReason = beforeStop.reason;
      await trace.record("loop.stopped", beforeStop);
      break;
    }

    const iterationIndex = state.iterations.length + 1;
    const iteration: IterationRecord = {
      index: iterationIndex,
      startedAt: new Date().toISOString()
    };
    state.iterations.push(iteration);
    await trace.record("iteration.started", { index: iterationIndex });

    iteration.snapshotPatchFile = await rollback.capturePatch(cwd, paths, iterationIndex);
    const context = await contextBuilder.build(spec, state, iterationIndex);
    iteration.contextFile = context.filePath;
    await trace.record("context.built", { index: iterationIndex, file: context.filePath, tokens: context.tokenEstimate });

    const runResult = await runner.run(spec, state, context, paths);
    iteration.plan = runResult.plan;
    iteration.execution = runResult.execution;
    iteration.feedback = buildFeedback(runResult.execution);
    applyExecutionBudget(state, runResult.execution);
    await trace.record("runner.finished", {
      index: iterationIndex,
      ok: runResult.execution.ok,
      exitCode: runResult.execution.exitCode,
      costUsd: runResult.execution.costUsd,
      tokens: runResult.execution.tokens
    });

    iteration.verification = await verifier.verify(spec, iteration, cwd);
    await trace.record("verifier.finished", {
      index: iterationIndex,
      passed: iteration.verification.passed,
      checks: iteration.verification.checks
    });

    iteration.rollback = await rollback.maybeRollback(spec, iteration, cwd);
    if (iteration.rollback.attempted) {
      await trace.record("rollback.finished", { index: iterationIndex, ...iteration.rollback });
    }

    iteration.finishedAt = new Date().toISOString();
    await appendProgress(paths.progressFile, iteration);
    await saveState(paths, state);

    const afterStop = stopPolicy.checkAfterIteration(spec, state, Boolean(options.once));
    if (afterStop.shouldStop) {
      state.status = "stopped";
      state.stopReason = afterStop.reason;
      await saveState(paths, state);
      await trace.record("loop.stopped", afterStop);
      break;
    }

    await scheduler.waitNext(spec);
  }

  await saveState(paths, state);
  return { state, traceFile: paths.traceFile, stateFile: paths.stateFile };
}

async function appendProgress(filePath: string, iteration: IterationRecord): Promise<void> {
  const status = iteration.verification?.passed ? "passed" : "failed";
  const summary = iteration.feedback?.outputSummary || "No feedback.";
  await appendFile(filePath, `## Iteration ${iteration.index}: ${status}\n\n${summary}\n\n`, "utf8");
}
