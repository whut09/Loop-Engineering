import type { LoopSpec } from "../core/types.js";

const dangerousCommandPatterns = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/s\b/i,
  /\bformat\b/i,
  /\bcurl\b.+\|\s*(sh|bash|powershell|pwsh)\b/i,
  /\biwr\b.+\|\s*(iex|powershell|pwsh)\b/i,
  /\binvoke-webrequest\b.+\|\s*(iex|powershell|pwsh)\b/i
];

export interface PermissionDecision {
  allowed: boolean;
  reason?: string;
}

export function guardRunnerCommand(spec: LoopSpec): PermissionDecision {
  const command = spec.runner.command;
  if (!command) return { allowed: true };

  for (const denied of spec.tools?.deny || []) {
    if (command.includes(denied.replace(/^shell\.run:\s*/, ""))) {
      return { allowed: false, reason: `Runner command matches denied policy: ${denied}` };
    }
  }

  for (const pattern of dangerousCommandPatterns) {
    if (pattern.test(command)) {
      return { allowed: false, reason: `Runner command looks unsafe: ${pattern}` };
    }
  }

  return { allowed: true };
}
