# LoopForge

[中文](README.md) | [English](README.en.md)

LoopForge is an open-source runtime for designing, running, observing, and evolving AI Agent Loops.

Prompt engineering focuses on making a model respond better once. Loop engineering focuses on the surrounding system: goal, context, tools, feedback, verification, stopping, rollback, and evolution.

## Architecture

![LoopForge v2 Architecture](docs/assets/loopforge-v2-architecture.png)

## Core Idea

LoopForge is not a scheduled AutoGPT clone, and it is not just a prompt repeated every few minutes.

It defines a loop as:

```text
Goal + Context + Agent + Tools + Feedback + Verifier + Stop Policy + Rollback + Trace
```

A good loop must know:

- when to continue
- when to stop
- when to roll back
- when to escalate to a human
- when to accept a change
- when to improve itself from failure traces

## Implemented Features

- Declarative `LoopSpec` YAML
- `dry-run`, `custom`, `opencode`, and `openharness` runner adapters
- Independent verifiers, so agents do not self-approve
- Stop policy and budget policy
- Git diff snapshots and failed-verifier rollback entry points
- JSONL trace timeline
- Persistent loop state, progress, memory, and artifacts
- CLI for initializing, running, listing, and inspecting loops
- Example PR CI fixer loop

## Quick Start

```bash
npm install
npm run build
npm run dev -- run examples/pr-ci-fixer.loop.yaml --once
```

The example runs a dry-run loop and writes state plus trace files under:

```text
.loopforge/loops/pr-ci-fixer/
```

## CLI

```bash
loopforge init pr-ci-fixer
loopforge run loops/pr-ci-fixer.loop.yaml --once
loopforge list
loopforge inspect pr-ci-fixer
```

In development mode:

```bash
npm run dev -- run examples/pr-ci-fixer.loop.yaml --once
```

## LoopSpec Example

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

context:
  include:
    - github_pr
    - changed_files
    - ci_logs
    - repo_instructions
    - previous_attempts
  max_tokens: 60000

budget:
  max_cost_usd: 3
  max_iterations: 8
  max_runtime: 2h
  min_interval: 5m
  stop_on_repeated_failure: 3

verifier:
  strategy: composite
  checks:
    - type: runner_exit_zero
    - type: diff_scope
      max_files_changed: 5
    - type: no_secret_access

stop:
  max_iterations: 8
  repeated_failure: 3
  no_progress: 3

rollback:
  strategy: git_worktree
  rollback_on_failed_verifier: true
  preserve_artifacts: true
```

## Project Structure

```text
src/
  agent/          runner adapters
  cli/            loopforge CLI
  context/        context builder
  core/           LoopSpec, runtime, state
  governance/     permissions, budget, stop, rollback
  io/             YAML, JSON, shell helpers
  scheduler/      trigger scheduler
  trace/          JSONL trace store
  verifier/       independent verifier
tests/            runtime tests
examples/         example LoopSpec files
docs/assets/      README assets
```

## Verification

```bash
npm run typecheck
npm run build
npm test
npm audit --audit-level=moderate
```

This MVP focuses on the core Loop Engineering skeleton: declarative specs, loop execution, independent verification, stop policies, rollback entry points, and traceable state. The next natural extensions are Web Dashboard, GitHub webhooks, Playwright verifier, failure mining, patch proposer, and eval gate.
