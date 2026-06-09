import { parseDuration } from "../core/duration.js";
import type { LoopSpec, LoopState, StopDecision } from "../core/types.js";

export class StopPolicy {
  checkBeforeIteration(spec: LoopSpec, state: LoopState): StopDecision {
    const stop = spec.stop || {};
    const budget = spec.budget || {};
    const maxIterations = stop.max_iterations ?? budget.max_iterations;
    const maxCost = stop.max_cost_usd ?? budget.max_cost_usd;
    const maxRuntime = stop.max_runtime ?? budget.max_runtime;

    if (maxIterations && state.iterations.length >= maxIterations) {
      return { shouldStop: true, reason: "max_iterations", message: `Reached ${maxIterations} iterations.` };
    }

    if (maxCost !== undefined && state.totals.costUsd >= maxCost) {
      return { shouldStop: true, reason: "max_cost", message: `Reached budget of $${maxCost}.` };
    }

    if (maxRuntime) {
      const runtimeMs = Date.now() - new Date(state.startedAt).getTime();
      if (runtimeMs >= parseDuration(maxRuntime)) {
        return { shouldStop: true, reason: "max_runtime", message: `Reached runtime limit ${maxRuntime}.` };
      }
    }

    const repeatedFailure = stop.repeated_failure ?? budget.stop_on_repeated_failure;
    if (repeatedFailure && countTrailingFailedVerifications(state) >= repeatedFailure) {
      return {
        shouldStop: true,
        reason: "repeated_failure",
        message: `Verifier failed ${repeatedFailure} times in a row.`
      };
    }

    const noProgress = stop.no_progress;
    if (noProgress && countTrailingNoProgress(state) >= noProgress) {
      return { shouldStop: true, reason: "no_progress", message: `No measurable progress for ${noProgress} iterations.` };
    }

    return { shouldStop: false };
  }

  checkAfterIteration(spec: LoopSpec, state: LoopState, once: boolean): StopDecision {
    const latest = state.iterations.at(-1);
    if (latest?.verification?.checks.some((check) => check.type === "human_required" && !check.passed)) {
      return { shouldStop: true, reason: "human_required", message: "Verifier requested human review." };
    }

    const requireHumanAfter = spec.budget?.require_human_after_cost_usd;
    if (requireHumanAfter !== undefined && state.totals.costUsd >= requireHumanAfter) {
      return { shouldStop: true, reason: "human_required", message: `Cost reached human-review threshold $${requireHumanAfter}.` };
    }

    if (once) {
      return { shouldStop: true, reason: "once", message: "Stopped after one requested iteration." };
    }

    return this.checkBeforeIteration(spec, state);
  }
}

function countTrailingFailedVerifications(state: LoopState): number {
  let count = 0;
  for (const iteration of [...state.iterations].reverse()) {
    if (iteration.verification?.passed === false) count += 1;
    else break;
  }
  return count;
}

function countTrailingNoProgress(state: LoopState): number {
  let count = 0;
  for (const iteration of [...state.iterations].reverse()) {
    const noProgress = iteration.execution?.ok === false || iteration.verification?.passed === false;
    if (noProgress) count += 1;
    else break;
  }
  return count;
}
