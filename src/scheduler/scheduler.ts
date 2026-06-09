import { parseDuration, sleep } from "../core/duration.js";
import type { LoopSpec } from "../core/types.js";

export class Scheduler {
  async waitNext(spec: LoopSpec): Promise<void> {
    if (spec.trigger.type !== "interval") return;
    const intervalMs = parseDuration(spec.trigger.every, 0);
    const minIntervalMs = parseDuration(spec.budget?.min_interval, 0);
    const waitMs = Math.max(intervalMs, minIntervalMs);
    if (waitMs > 0) await sleep(waitMs);
  }
}
