#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import YAML from "yaml";
import { getLoopPaths } from "../core/paths.js";
import { runLoop } from "../core/runtime.js";
import type { LoopSpec } from "../core/types.js";
import { loadLoopSpec } from "../io/spec_loader.js";

const program = new Command();

program
  .name("loopforge")
  .description("Runtime for engineering AI agent loops.")
  .version("0.1.0");

program
  .command("init")
  .argument("<name>", "Loop name")
  .option("--dir <dir>", "Directory for generated spec", "loops")
  .description("Create a starter LoopSpec YAML file.")
  .action(async (name: string, options: { dir: string }) => {
    const cwd = process.cwd();
    const dir = path.resolve(cwd, options.dir);
    await mkdir(dir, { recursive: true });
    const spec = starterSpec(name);
    const filePath = path.join(dir, `${name}.loop.yaml`);
    await writeFile(filePath, YAML.stringify(spec), { flag: "wx", encoding: "utf8" });
    console.log(`Created ${filePath}`);
  });

program
  .command("run")
  .argument("<spec>", "Path to LoopSpec YAML")
  .option("--cwd <cwd>", "Workspace directory", process.cwd())
  .option("--once", "Run a single iteration")
  .option("--max-iterations <count>", "CLI override for maximum iterations")
  .description("Run a loop.")
  .action(async (specPath: string, options: { cwd: string; once?: boolean; maxIterations?: string }) => {
    const spec = await loadLoopSpec(path.resolve(process.cwd(), specPath));
    const result = await runLoop(spec, {
      cwd: path.resolve(process.cwd(), options.cwd),
      once: options.once,
      maxIterationsOverride: options.maxIterations ? Number(options.maxIterations) : undefined
    });
    console.log(`Loop ${result.state.name} stopped with reason: ${result.state.stopReason || "none"}`);
    console.log(`State: ${result.stateFile}`);
    console.log(`Trace: ${result.traceFile}`);
  });

program
  .command("list")
  .option("--cwd <cwd>", "Workspace directory", process.cwd())
  .description("List loops with saved state.")
  .action(async (options: { cwd: string }) => {
    const loopsDir = path.join(path.resolve(process.cwd(), options.cwd), ".loopforge", "loops");
    try {
      const entries = await readdir(loopsDir, { withFileTypes: true });
      for (const entry of entries.filter((item) => item.isDirectory())) {
        console.log(entry.name);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  });

program
  .command("inspect")
  .argument("<name>", "Loop name")
  .option("--cwd <cwd>", "Workspace directory", process.cwd())
  .description("Print saved state for a loop.")
  .action(async (name: string, options: { cwd: string }) => {
    const paths = getLoopPaths(path.resolve(process.cwd(), options.cwd), { name });
    const raw = await readFile(paths.stateFile, "utf8");
    console.log(raw);
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function starterSpec(name: string): LoopSpec {
  return {
    name,
    goal: "Describe the long-running goal this loop should pursue.",
    trigger: {
      type: "interval",
      every: "10m"
    },
    runner: {
      type: "dry-run"
    },
    context: {
      include: ["goal", "working_state", "latest_feedback", "loop_memory"],
      max_tokens: 60000
    },
    tools: {
      allow: ["file.read", "file.edit", "shell.run", "git.diff"],
      ask: ["git.push"],
      deny: ["file.read: .env", "shell.run: rm -rf", "shell.run: curl * | sh"]
    },
    verifier: {
      strategy: "composite",
      checks: [{ type: "runner_exit_zero" }, { type: "no_secret_access" }]
    },
    budget: {
      max_cost_usd: 3,
      max_iterations: 8,
      max_runtime: "2h",
      min_interval: "5m",
      stop_on_repeated_failure: 3
    },
    stop: {
      max_iterations: 8,
      repeated_failure: 3,
      no_progress: 3
    },
    rollback: {
      strategy: "git_worktree",
      rollback_on_failed_verifier: true,
      preserve_artifacts: true
    },
    evolution: {
      enabled: false,
      propose_updates_to: ["loop_prompt", "verifier_rubric", "context_policy"]
    }
  };
}
