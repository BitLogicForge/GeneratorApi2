---
name: generatorapi-quality
description: Implement features and fixes in Generator API's Node.js, TypeScript, and Express code while preserving simple boundaries and maintainability. Use for changes to routes, reports, services, configuration, or queues; keep work scoped to the requested change.
---

# Generator API: code quality

Read the repository's [AGENTS.md](../../../AGENTS.md) and current
[package.json](../../../package.json). Use the code map to inspect the affected
flow and callers. Apply the verification policy in AGENTS.md; it also applies
when this skill is used with another skill.

## Choose the smallest clear design

- Keep request decoding and schemas in the HTTP/report boundary, generation in
  services, and document manipulation in the existing PDF/PPTX modules. Reuse
  the report definitions and service container rather than adding a parallel
  dispatch mechanism.
- Keep report-specific mappings, filenames, and print settings with the report.
  A new report should not require another property in the global dependency
  interface. Check the current report registration pattern before wiring it.
- Extract shared code when existing callers have the same rules, error behavior,
  and reason to change. Similar-looking PDF and PPTX flows alone do not justify
  combining them. Keep a small amount of readable duplication when a shared
  abstraction would need flags or callbacks for each caller.
- Prefer existing functions and explicit data flow. Introduce a factory, class,
  dependency, or configuration option only when it solves a concrete need in
  this task. Do not split files merely to meet an arbitrary line limit.
- Keep values typed across validation and service boundaries. Reuse schema and
  contract types; avoid a second hand-maintained model of the same input.
  Fix the source of a type mismatch rather than hiding it with `any`, assertions,
  or lint suppressions.

## Preserve behavior at the boundaries

Trace route → decoding → schema → queue/service → response for HTTP changes.
Inspect both GET and POST when they share helpers. Preserve defaults, validation,
HEAD behavior, download headers, request IDs, and the existing error model unless
the request changes that contract. Update endpoint documentation with intentional
contract changes.

For asynchronous changes, preserve ownership of timers, listeners, pages, and
browser resources. Cleanup belongs to the operation that owns the resource.
Cancellation of a queued wait must not free the slot of rendering still in
progress; preserve this distinction during timeout and shutdown changes.

For PPTX changes, preserve editable content and formatting. Inspect the related
ZIP/XML parts, relationships, and embedded workbook when editing chart data.
Never write generated changes back into the source template.

## Finish the change

Review the diff for unnecessary exports, options, wrappers, and unrelated edits.
Use `.ts` extensions for local TypeScript imports and extensionless `@/` or
`@examples/` aliases for distant modules. Let Prettier format changed files.

Run the static checks required by AGENTS.md for the actual change. Do not add or
run tests automatically, invoke a test-running aggregate command, install a
browser for verification, or generate document artifacts unless the user asks
for that work. Reading existing tests to understand contracts is useful and does
not imply running or expanding them. Once relevant checks pass, stop checking
unless a new change or unresolved failure warrants another run.

Report the resulting behavior, meaningful design choices, checks actually run,
and any concrete behavior left unverified. Do not equate static checks with
runtime verification.
