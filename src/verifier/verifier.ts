import { access } from "node:fs/promises";
import path from "node:path";
import { parseDuration } from "../core/duration.js";
import type {
  CheckResult,
  IterationRecord,
  LoopSpec,
  VerifierCheckSpec,
  VerificationResult
} from "../core/types.js";
import { runShell, summarizeOutput } from "../io/shell.js";

export class Verifier {
  async verify(spec: LoopSpec, iteration: IterationRecord, cwd: string): Promise<VerificationResult> {
    const checks = spec.verifier?.checks?.length ? spec.verifier.checks : [{ type: "runner_exit_zero" } satisfies VerifierCheckSpec];
    const results: CheckResult[] = [];
    for (const check of checks) {
      results.push(await this.runCheck(check, iteration, cwd));
    }
    return {
      passed: results.every((result) => result.passed),
      checks: results
    };
  }

  private async runCheck(check: VerifierCheckSpec, iteration: IterationRecord, cwd: string): Promise<CheckResult> {
    const name = check.name || check.type;

    if (check.type === "always_pass") {
      return { name, type: check.type, passed: true, message: "Accepted by always_pass check." };
    }

    if (check.type === "runner_exit_zero") {
      const passed = iteration.execution?.exitCode === 0 && iteration.execution.ok;
      return {
        name,
        type: check.type,
        passed,
        message: passed ? "Runner exited successfully." : `Runner failed with exit code ${iteration.execution?.exitCode}.`
      };
    }

    if (check.type === "command" || check.type === "tests_passed") {
      const result = await runShell(check.command, {
        cwd,
        timeoutMs: parseDuration(check.timeout, 20 * 60_000)
      });
      const passed = result.exitCode === 0 && !result.timedOut;
      return {
        name,
        type: check.type,
        passed,
        message: passed ? "Command verifier passed." : summarizeOutput(result.stdout, result.stderr || "Command verifier failed.")
      };
    }

    if (check.type === "file_exists") {
      const target = path.resolve(cwd, check.path);
      try {
        await access(target);
        return { name, type: check.type, passed: true, message: `${check.path} exists.` };
      } catch {
        return { name, type: check.type, passed: false, message: `${check.path} does not exist.` };
      }
    }

    if (check.type === "diff_scope") {
      const result = await runShell("git diff --name-only", { cwd });
      if (result.exitCode !== 0) {
        return { name, type: check.type, passed: true, message: "No git repo detected; diff_scope skipped." };
      }
      const files = result.stdout.split(/\r?\n/).filter(Boolean);
      const passed = files.length <= check.max_files_changed;
      return {
        name,
        type: check.type,
        passed,
        message: passed
          ? `Changed ${files.length} files within limit ${check.max_files_changed}.`
          : `Changed ${files.length} files, above limit ${check.max_files_changed}: ${files.join(", ")}`
      };
    }

    if (check.type === "no_secret_access") {
      const patterns = check.patterns || [".env", "id_rsa", "AWS_SECRET", "OPENAI_API_KEY"];
      const haystack = `${iteration.execution?.stdout || ""}\n${iteration.execution?.stderr || ""}`;
      const hit = patterns.find((pattern) => haystack.includes(pattern));
      return {
        name,
        type: check.type,
        passed: !hit,
        message: hit ? `Runner output referenced sensitive pattern: ${hit}` : "No sensitive pattern appeared in runner output."
      };
    }

    if (check.type === "human_required") {
      return {
        name,
        type: check.type,
        passed: false,
        message: check.reason || "Human approval is required."
      };
    }

    const exhaustive: never = check;
    return {
      name,
      type: "unknown",
      passed: false,
      message: `Unsupported verifier check: ${JSON.stringify(exhaustive)}`
    };
  }
}
