import { spawn } from "node:child_process";

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ShellOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export function runShell(command: string, options: ShellOptions): Promise<ShellResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer =
      options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeoutMs)
        : undefined;

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

export function summarizeOutput(stdout: string, stderr: string, maxChars = 1200): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n--- stderr ---\n");
  if (combined.length <= maxChars) return combined;
  return `${combined.slice(0, maxChars)}\n... truncated ...`;
}
