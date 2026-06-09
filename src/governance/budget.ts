import type { LoopState, RunnerExecution } from "../core/types.js";

export function applyExecutionBudget(state: LoopState, execution: RunnerExecution): void {
  state.totals.costUsd += execution.costUsd;
  state.totals.tokens += execution.tokens;
}
