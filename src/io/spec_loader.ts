import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { validateLoopSpec } from "../core/schema.js";
import type { LoopSpec } from "../core/types.js";

export async function loadLoopSpec(filePath: string): Promise<LoopSpec> {
  const raw = await readFile(filePath, "utf8");
  const value = YAML.parse(raw);
  return validateLoopSpec(value);
}
