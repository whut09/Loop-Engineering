import path from "node:path";
import type { LoopSpec } from "./types.js";

export interface LoopPaths {
  rootDir: string;
  loopDir: string;
  artifactsDir: string;
  snapshotsDir: string;
  stateFile: string;
  traceFile: string;
  memoryFile: string;
  progressFile: string;
}

export function getLoopPaths(cwd: string, spec: Pick<LoopSpec, "name">): LoopPaths {
  const rootDir = path.join(cwd, ".loopforge");
  const loopDir = path.join(rootDir, "loops", spec.name);
  return {
    rootDir,
    loopDir,
    artifactsDir: path.join(loopDir, "artifacts"),
    snapshotsDir: path.join(loopDir, "snapshots"),
    stateFile: path.join(loopDir, "state.json"),
    traceFile: path.join(loopDir, "trace.jsonl"),
    memoryFile: path.join(loopDir, "memory.md"),
    progressFile: path.join(loopDir, "progress.md")
  };
}
