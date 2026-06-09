import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoopPaths } from "../core/paths.js";
import type { LoopSpec, LoopState } from "../core/types.js";

export interface BuiltContext {
  filePath: string;
  text: string;
  tokenEstimate: number;
}

export class ContextBuilder {
  constructor(private readonly paths: LoopPaths) {}

  async build(spec: LoopSpec, state: LoopState, iterationIndex: number): Promise<BuiltContext> {
    await mkdir(this.paths.artifactsDir, { recursive: true });
    const memory = await readOptional(this.paths.memoryFile);
    const progress = await readOptional(this.paths.progressFile);
    const latest = state.iterations.at(-1);
    const include = spec.context?.include?.join(", ") || "goal, state, latest_feedback, loop_memory";

    const text = [
      `# LoopForge Context`,
      ``,
      `Loop: ${spec.name}`,
      `Iteration: ${iterationIndex}`,
      `Goal:`,
      spec.goal,
      ``,
      `Requested context: ${include}`,
      ``,
      `## Working State`,
      JSON.stringify(
        {
          status: state.status,
          startedAt: state.startedAt,
          totals: state.totals,
          iterationCount: state.iterations.length,
          latestVerification: latest?.verification,
          latestFeedback: latest?.feedback
        },
        null,
        2
      ),
      ``,
      `## Progress`,
      progress || "No progress notes yet.",
      ``,
      `## Loop Memory`,
      memory || "No loop memory yet."
    ].join("\n");

    const tokenEstimate = Math.ceil(text.length / 4);
    const filePath = path.join(this.paths.artifactsDir, `context.iteration-${iterationIndex}.md`);
    await writeFile(filePath, text, "utf8");
    return { filePath, text, tokenEstimate };
  }
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
