---
name: generatorapi-refactor
description: Simplify and organize existing Generator API code while preserving behavior. Use when asked to refactor, clean up duplication, move responsibilities, or remove unused code; avoid expanding ordinary feature work into a repository-wide cleanup.
---

# Generator API: focused refactoring

Use the repository's [AGENTS.md](../../../AGENTS.md) for architectural invariants,
import rules, and verification policy. Inspect the affected code and callers
before changing a shared function, type, or file location.

## Establish the benefit and scope

Identify the specific maintenance cost: repeated business rules, unclear resource
ownership, mixed responsibilities, unnecessary indirection, or unused code.
Choose a change that makes the current behavior easier to understand and modify.
Do not treat fewer lines or more files as evidence of improvement.

Keep behavior changes outside a cleanup unless the user requests them. Preserve
defaults, parsing order, validation, error statuses, asynchronous ordering, and
cleanup behavior, including the queue and document invariants in AGENTS.md.

## Simplify with existing structure

- Put route-specific schemas and report configuration near their report. Use the
  existing report definitions and service registry; avoid growing central
  conditionals or a global dependency interface for each new report.
- Keep low-level PPTX XML/workbook operations in `src/pptx/jszip/` and orchestration
  in reports/services. Do not make a route handler own document internals.
- Share a helper only when its current callers share the same semantics. If
  extraction needs caller-specific switches or callbacks, consider leaving the
  logic local. Remove indirection when it adds no meaningful boundary.
- Replace deeply nested code with explicit branches when that clarifies errors
  and ownership. Preserve execution order and side effects.
- Rename or move files only when the responsibility becomes easier to locate.
  Update imports, examples, documentation, and dynamic registrations that depend
  on their location. Do not create barrel files just to hide import paths.

## Prove that deletion is safe

Check callers and configuration before deleting an export, file, or dependency.
Route `get.ts`, `post.ts`, schemas, and report modules may be discovered dynamically.
Standalone scripts and examples may be entry points without source imports.
Inspect discovery and npm scripts; a text search with no matches is insufficient.

Run Knip for code, export, dependency, or entry-point changes. Investigate each
finding against actual discovery and callers. Add a genuine standalone entry
point to `knip.json` when needed; do not expand ignore lists to conceal a finding.

## Validate proportionally

Follow AGENTS.md: use type checking, code lint, Knip, and changed-file formatting
as applicable. Build when changing compilation, import rewriting, or entry points.
Tests are only added or run when explicitly requested. Do not create replacement
tests for renamed private helpers or rerun a whole suite because files moved.
Preserve existing tests and CI checks.

Review the final diff for accidental contract changes and unrelated cleanup.
Explain the concrete maintenance benefit and report which checks ran. State any
remaining runtime uncertainty without claiming behavior was tested.
