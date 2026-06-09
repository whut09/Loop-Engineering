import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoopPaths } from "../core/paths.js";
import type { IterationRecord, LoopSpec, RollbackResult } from "../core/types.js";
import { runShell } from "../io/shell.js";

export class RollbackManager {
  async capturePatch(cwd: string, paths: LoopPaths, iterationIndex: number): Promise<string | undefined> {
    if (!(await isGitRepo(cwd))) return undefined;
    const result = await runShell("git diff --binary", { cwd });
    const patch = result.stdout;
    if (!patch.trim()) return undefined;
    await mkdir(paths.snapshotsDir, { recursive: true });
    const patchFile = path.join(paths.snapshotsDir, `before-iteration-${iterationIndex}.patch`);
    await writeFile(patchFile, patch, "utf8");
    return patchFile;
  }

  async maybeRollback(spec: LoopSpec, iteration: IterationRecord, cwd: string): Promise<RollbackResult> {
    if (spec.rollback?.strategy !== "git_worktree" || !spec.rollback.rollback_on_failed_verifier) {
      return { attempted: false, succeeded: false, reason: "Rollback disabled." };
    }
    if (iteration.verification?.passed !== false) {
      return { attempted: false, succeeded: false, reason: "Verification passed." };
    }
    if (!(await isGitRepo(cwd))) {
      return { attempted: false, succeeded: false, reason: "Not a git repository." };
    }

    const result = await runShell("git diff --binary | git apply -R --whitespace=nowarn", { cwd });
    return {
      attempted: true,
      succeeded: result.exitCode === 0,
      reason: result.exitCode === 0 ? "Reverted uncommitted diff after failed verifier." : result.stderr || "Rollback failed."
    };
  }
}

async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await runShell("git rev-parse --is-inside-work-tree", { cwd });
  return result.exitCode === 0 && result.stdout.trim() === "true";
}
