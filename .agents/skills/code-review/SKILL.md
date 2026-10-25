---
name: code-review
description: Review TypeScript and Node.js code or diffs for concrete correctness bugs, resource leaks, boundary mismatches, unnecessary complexity, and unclear module responsibilities. Use when asked for a code review, PR review, or quality audit.
---

# Code Review: Expert Audit Guide

Read the repository's [AGENTS.md](../../../AGENTS.md). Review the exact scope
requested by the user—a diff, module, flow, or repository. When reviewing a
diff, inspect nearby context and callers rather than starting an unrelated
repository-wide audit. Treat a review as read-only unless the user also asks you
to apply fixes.

## Prioritize Concrete Impact and Simplicity

Focus on confirmed defects, operational risks, and real maintenance costs
demonstrated by the code:

- **Contract & Boundary Mismatches**: Transport decoding, runtime validation
  schemas, and service types disagree; HTTP methods, status codes, headers, or
  error payloads diverge unexpectedly.
- **Async Lifecycle & Concurrency Bugs**: Timeouts, aborts, or shutdown paths
  leave timers, event listeners, or external handles behind, or release a
  concurrency slot before the active task completes.
- **State & Data Integrity**: Shared or cached objects are mutated in place,
  partial updates leave dependent state out of sync, or untrusted input bypasses
  validation boundaries.
- **Misplaced Responsibilities & Complexity**: A single file or handler mixes
  transport, validation, orchestration, and low-level data manipulation instead
  of using small, single-purpose modules.
- **Dead Weight**: Unused exports, pass-through wrappers, speculative
  configuration options, or duplicated business rules that have already drifted
  apart.

Ignore formatting details handled by Prettier, and separate optional readability
or structure suggestions from confirmed defects.

## Require Evidence and Report Actionable Findings

For every suspected issue, trace the caller, data flow, and resource lifecycle
until the runtime or maintenance effect is certain. Check dynamic entry points
and scripts before flagging code as unused. Use static checks only when they
answer a specific review question or when requested, following the verification
policy in `AGENTS.md` (do not run tests or generate artifacts by default). If a
runtime concern cannot be proven statically, label it as an open question and
state what observation would confirm it.

Order findings by severity. For each finding, cite the exact file and line
range, explain the trigger and impact, and propose the smallest clear fix.
Conclude with the review scope, static checks run, and any remaining runtime
uncertainty.
