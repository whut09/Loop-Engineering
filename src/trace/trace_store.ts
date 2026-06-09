import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface TraceEvent {
  type: string;
  at: string;
  data?: unknown;
}

export class TraceStore {
  constructor(private readonly traceFile: string) {}

  async record(type: string, data?: unknown): Promise<void> {
    await mkdir(path.dirname(this.traceFile), { recursive: true });
    const event: TraceEvent = { type, at: new Date().toISOString(), data };
    await appendFile(this.traceFile, `${JSON.stringify(event)}\n`, "utf8");
  }

  async readAll(): Promise<TraceEvent[]> {
    try {
      const raw = await readFile(this.traceFile, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as TraceEvent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
