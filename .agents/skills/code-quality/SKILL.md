---
name: code-quality
description: Implement features and fixes in TypeScript and Node.js codebases while preserving clean boundaries, small single-responsibility files, and human readability. Use for feature work, bug fixes, service logic, validation, or configuration changes.
---

# Code Quality: Implementation Guide

Read the repository's [AGENTS.md](../../../AGENTS.md) and
[package.json](../../../package.json) before making changes. Trace the affected
call chain and existing contracts first, and keep your work strictly scoped to
the requested change.

## Design for Human Readability

- Prefer small, focused files where each module owns one distinct
  responsibility. When a file mixes orchestration with low-level steps, split
  those steps into dedicated helper modules with clear names.
- Keep transport decoding, runtime schema validation, business/service
  orchestration, and low-level data manipulation separate. Reuse existing
  registries and dependency containers instead of introducing parallel dispatch
  mechanisms.
- Extract shared helpers when callers share the same rules, error semantics, and
  reason to change. Keep a small amount of readable duplication when a combined
  abstraction would require caller-specific flags or callbacks.
- Prefer direct functions and explicit data flow. Introduce classes, factories,
  dependencies, or configuration options only when they solve a concrete need in
  the current task. Avoid pass-through wrappers and barrel files.
- Keep values strongly typed across validation and service boundaries. Derive
  types from runtime schemas and contracts rather than maintaining duplicate
  interfaces. Fix the root cause of type mismatches instead of hiding them with
  `any`, type assertions, or lint suppressions.

## Preserve Boundaries and Resource Lifecycles

Trace the full request or execution path—input decoding, schema validation,
concurrency/queueing, service execution, and response/error mapping—before
changing shared behavior. Preserve existing defaults, status codes, headers, and
error structures unless the task explicitly changes that contract. Update
documentation whenever public contracts change.

For asynchronous and I/O operations, keep ownership of timers, event listeners,
streams, and external handles explicit. The operation that acquires a resource
is responsible for releasing it in all completion, timeout, and cancellation
paths. Never release a concurrency slot before the underlying active task has
actually finished.

## Verify and Finish Cleanly

Review the diff for accidental contract changes, unused exports, unnecessary
options, and unrelated edits. Follow the repository's import conventions and let
Prettier handle formatting.

Run the static checks defined in `AGENTS.md` (such as typechecking, linting, and
dead-code/unused-export checks) appropriate to the change. Do not add or run
tests automatically or invoke test-running aggregate scripts unless the user
explicitly asks for tests. Reading existing tests to understand contracts is
encouraged. Once relevant static checks pass, stop checking and report the
resulting behavior, key design choices, checks run, and any unverified runtime
behavior.
