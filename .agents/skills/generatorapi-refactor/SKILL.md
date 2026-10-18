---
name: generatorapi-refactor
description: Simplify and organize existing Generator API code while preserving behavior. Use when the user asks to refactor, clean up duplication, move responsibilities, extract or inline helpers, reorganize modules, or remove unused code and exports in the Generator API codebase. Avoid expanding ordinary feature work into a repository-wide cleanup.
---

# Generator API Refactor

Simplify and organize existing Generator API code while strictly preserving runtime behavior, contracts, and architectural boundaries.

## When to Use

- Refactoring existing Generator API routes, reports, services, or PPTX utilities
- Cleaning up duplicated business rules or consolidating shared logic
- Moving responsibilities between route handlers, report definitions, services, and `src/pptx/jszip/`
- Removing unused exports, files, dependencies, or dead code

## Steps

### 1. Establish the Benefit and Scope

1. Read the repository's `AGENTS.md` to verify architectural invariants, import rules, and verification policies.
2. Inspect the affected code and all callers before changing a shared function, type, or file location.
3. Identify the concrete maintenance cost you are solving: repeated business rules, unclear resource ownership, mixed responsibilities, unnecessary indirection, or unused code.
4. Keep behavior changes out of the cleanup unless explicitly requested. Preserve defaults, parsing order, validation, error statuses, asynchronous ordering, and cleanup behavior (including queue and document invariants in `AGENTS.md`).

### 2. Simplify Within Existing Structure

- **Co-locate report concerns:** Put route-specific schemas and report configuration near their report. Use existing report definitions and the service registry rather than growing central conditionals or global dependency interfaces for each report.
- **Enforce PPTX boundaries:** Keep low-level PPTX XML and workbook operations inside `src/pptx/jszip/` and keep orchestration in reports and services. Never let a route handler own document internals.
- **Extract helpers conservatively:** Share a helper only when current callers share identical semantics. If extraction requires caller-specific boolean flags, switches, or callbacks, leave the logic local. Remove thin wrapper functions that add no meaningful boundary.
- **Flatten control flow:** Replace deeply nested conditions with explicit guard clauses and branches when that clarifies error handling and resource ownership, while strictly preserving execution order and side effects.
- **Move or rename deliberately:** Rename or move files only when it makes responsibilities easier to locate. Update all imports, examples, documentation, and dynamic registrations that depend on the path. Do not introduce barrel (`index.ts`) files just to hide import paths.

### 3. Prove That Deletion Is Safe

1. Check both static callers and dynamic configuration before deleting an export, file, or dependency.
2. Inspect dynamic discovery mechanisms and `package.json` scripts (`get.ts`, `post.ts`, route schemas, report modules, standalone scripts, and examples often act as entry points without direct source imports).
3. Run Knip whenever changing code structure, exports, dependencies, or entry points.
4. Investigate each Knip finding against actual runtime discovery and callers. If a file is a genuine standalone entry point, register it in `knip.json` rather than expanding ignore lists to hide findings.

### 4. Validate Proportionally and Report

1. Run the verification tools specified in `AGENTS.md`: type checking, linting, Knip, and formatting on changed files.
2. Run the build when modifying compilation settings, import resolution, or entry points.
3. Preserve existing tests and CI checks. Do not add new tests, create replacement tests for renamed private helpers, or rerun the full test suite unless explicitly requested by the user.
4. Review the final `git diff` to ensure no accidental contract changes or unrelated edits slipped in.
5. Report the concrete maintenance benefit achieved, list the verification checks executed, and explicitly state any remaining runtime uncertainty without claiming untested behavior was verified.

## Gotchas

- **Line count is not a metric:** Do not treat fewer lines of code or a higher number of small files as automatic evidence of improvement.
- **Text search is not enough for deletions:** A `grep` or text search returning zero matches does not prove a module is unused in a codebase with dynamic route and report discovery. Always verify discovery rules and run Knip.
- **Scope creep during feature work:** Do not expand routine feature requests or bug fixes into repository-wide refactoring passes.
- **Premature abstraction:** Combining two blocks of code that merely look similar today into a parameterized helper often couples unrelated reports. Keep them separate until semantics truly match.