import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runLoop } from "../src/core/runtime.js";
import type { LoopSpec } from "../src/core/types.js";
import { loadLoopSpec } from "../src/io/spec_loader.js";

describe("LoopForge runtime", () => {
  it("runs a dry-run loop once and writes state plus trace", async () => {
    const cwd = await tempDir();
    try {
      const spec: LoopSpec = {
        name: "dry-loop",
        goal: "Prove the loop runtime can run once.",
        trigger: { type: "interval", every: "1s" },
        runner: { type: "dry-run" },
        verifier: { checks: [{ type: "runner_exit_zero" }] },
        stop: { max_iterations: 3 }
      };

      const result = await runLoop(spec, { cwd, once: true });

      expect(result.state.stopReason).toBe("once");
      expect(result.state.iterations).toHaveLength(1);
      expect(result.state.iterations[0].verification?.passed).toBe(true);

      const trace = await readFile(result.traceFile, "utf8");
      expect(trace).toContain("iteration.started");
      expect(trace).toContain("verifier.finished");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("loads a YAML LoopSpec", async () => {
    const cwd = await tempDir();
    try {
      const file = path.join(cwd, "loop.yaml");
      await writeFile(
        file,
        [
          "name: yaml-loop",
          "goal: Validate YAML loading.",
          "trigger:",
          "  type: interval",
          "  every: 1s",
          "runner:",
          "  type: dry-run"
        ].join("\n"),
        "utf8"
      );

      const spec = await loadLoopSpec(file);
      expect(spec.name).toBe("yaml-loop");
      expect(spec.runner.type).toBe("dry-run");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("records verifier failure", async () => {
    const cwd = await tempDir();
    try {
      const spec: LoopSpec = {
        name: "failing-loop",
        goal: "Fail verification.",
        trigger: { type: "interval", every: "1s" },
        runner: { type: "dry-run" },
        verifier: { checks: [{ type: "file_exists", path: "missing.txt" }] },
        stop: { max_iterations: 1 }
      };

      const result = await runLoop(spec, { cwd });

      expect(result.state.stopReason).toBe("max_iterations");
      expect(result.state.iterations[0].verification?.passed).toBe(false);
      expect(result.state.iterations[0].verification?.checks[0].message).toContain("does not exist");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "loopforge-"));
}
