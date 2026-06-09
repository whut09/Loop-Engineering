import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { LoopPaths } from "./paths.js";
import type { LoopSpec, LoopState } from "./types.js";
import { readJsonFile, writeJsonFile } from "../io/json.js";

export async function loadOrCreateState(spec: LoopSpec, cwd: string, paths: LoopPaths): Promise<LoopState> {
  const existing = await readJsonFile<LoopState>(paths.stateFile);
  if (existing) return existing;

  const now = new Date().toISOString();
  const state: LoopState = {
    loopId: randomUUID(),
    name: spec.name,
    goal: spec.goal,
    cwd,
    startedAt: now,
    updatedAt: now,
    iterations: [],
    totals: {
      costUsd: 0,
      tokens: 0
    },
    status: "running"
  };
  await saveState(paths, state);
  await ensureLoopFiles(paths, spec);
  return state;
}

export async function saveState(paths: LoopPaths, state: LoopState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await writeJsonFile(paths.stateFile, state);
}

async function ensureLoopFiles(paths: LoopPaths, spec: LoopSpec): Promise<void> {
  await mkdir(paths.loopDir, { recursive: true });
  await mkdir(paths.artifactsDir, { recursive: true });
  await mkdir(paths.snapshotsDir, { recursive: true });
  await writeFileIfMissing(paths.progressFile, `# Progress: ${spec.name}\n\n`);
  await writeFileIfMissing(paths.memoryFile, `# Loop Memory: ${spec.name}\n\n`);
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, { flag: "wx", encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
