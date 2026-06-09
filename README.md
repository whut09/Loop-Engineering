# LoopForge

LoopForge is an open-source runtime for engineering AI agent loops.

Prompt engineering tells an agent what to do once. Loop engineering designs the system that keeps asking, checking, stopping, rolling back, and improving until the goal is actually achieved.

## What It Provides

- Declarative `LoopSpec` YAML
- Interval, event, and goal-driven loop shapes
- Agent runner adapters
- Independent verifiers
- Budget and stop policies
- Git-based rollback snapshots
- JSONL trace timeline and replay-friendly state
- A first path toward loop evolution through trace mining

## Quick Start

```bash
npm install
npm run build
npm run dev -- run examples/pr-ci-fixer.loop.yaml --once
```

The dry-run example writes loop state and trace files under:

```text
.loopforge/loops/pr-ci-fixer/
```

## LoopSpec

```yaml
name: pr-ci-fixer
goal: >
  Keep the current pull request green. If CI fails, diagnose the failure,
  make the minimal fix, run the relevant tests, and accept only verified work.

trigger:
  type: interval
  every: 10m

runner:
  type: dry-run

budget:
  max_cost_usd: 3
  max_iterations: 8
  max_runtime: 2h

verifier:
  strategy: composite
  checks:
    - type: runner_exit_zero
    - type: diff_scope
      max_files_changed: 5

stop:
  max_iterations: 8
  repeated_failure: 3
  no_progress: 3

rollback:
  strategy: git_worktree
  rollback_on_failed_verifier: true
```

## CLI

```bash
loopforge init pr-ci-fixer
loopforge run loops/pr-ci-fixer.loop.yaml --once
loopforge list
loopforge inspect pr-ci-fixer
```

## Core Idea

A loop is not `while true: ask_llm("continue")`.

A loop is:

```text
Goal + Context + Agent + Tools + Feedback + Verifier + Stop Policy + Rollback + Trace
```

LoopForge treats stop conditions, verifier independence, budget, rollback, and trace as first-class runtime features.
