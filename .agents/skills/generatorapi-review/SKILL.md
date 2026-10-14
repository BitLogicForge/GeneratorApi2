---
name: generatorapi-review
description: Review Generator API code or a diff for concrete correctness and maintenance problems, unnecessary complexity, and misplaced responsibilities. Use for a requested code review or quality audit; report evidence and minimal fixes without automatically editing code or running tests.
---

# Generator API: code review

Read the repository's [AGENTS.md](../../../AGENTS.md). Review the scope requested
by the user: a diff, module, flow, or repository. For a diff, inspect nearby code
and affected callers rather than starting an unrelated audit. Treat the review
as read-only unless the user also requests fixes.

## Review what changes decisions

Prioritize bugs and maintenance costs demonstrated by the actual code:

- HTTP decoding, schema, and service contracts disagree; GET and POST diverge;
  defaults, HEAD, error responses, or download metadata change unexpectedly.
- Timeout, cancellation, or shutdown handling leaves timers/listeners/resources
  behind or releases a rendering slot before its task finishes.
- PPTX changes update chart XML without the corresponding workbook or
  relationships, lose editability, or mutate a source template.
- A report-specific detail leaks into global configuration or wiring; a handler
  owns validation, service orchestration, and low-level document manipulation.
- A wrapper, configurable abstraction, dependency, or export introduces work for
  maintainers without serving a concrete caller or requirement.
- Business rules are duplicated and already inconsistent, or an attempted shared
  helper obscures genuinely different PDF/PPTX behavior.

Only pursue the areas relevant to the reviewed code. Formatting preferences that
Prettier already handles, arbitrary function/file length, and missing tests by
themselves are not findings. Keep stylistic suggestions separate from defects.

## Require evidence

For a suspected issue, trace the caller and data or resource lifecycle until the
effect is clear. Check dynamic route/report discovery and npm entry points before
calling code unused. Existing tests and documentation can clarify intent, but
the implementation is the source of truth.

Use static checks only when they resolve a concrete review question or the user
requests them. Follow the verification policy in AGENTS.md. Do not add or run
tests, run test-bearing verification scripts, or generate artifacts by default.
If a runtime concern remains uncertain, label it as an open question and describe
the specific observation needed; do not present it as a confirmed defect.

## Return actionable findings

Order confirmed findings by impact. For each, give a file and line, the concrete
trigger or maintenance cost, its effect, and the smallest useful fix. Avoid
suggesting a redesign when a local change addresses the problem.

If there are no confirmed issues, say so without inventing cleanup work. Briefly
report the review scope, checks actually run, and relevant uncertainty. Do not
claim that the absence of findings proves runtime correctness.
