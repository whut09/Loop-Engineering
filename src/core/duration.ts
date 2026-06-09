const units: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
};

export function parseDuration(input: string | undefined, fallbackMs = 0): number {
  if (!input) return fallbackMs;
  const match = input.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration: ${input}`);
  }
  return Number(match[1]) * units[match[2]];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
