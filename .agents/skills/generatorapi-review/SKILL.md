---
name: generatorapi-review
description: Review Generator API code or a diff for concrete correctness and maintenance problems, unnecessary complexity, and misplaced responsibilities. Use when the user asks for a code review, PR/diff review, or quality audit in the Generator API codebase; report evidence and minimal fixes without automatically editing code or running tests.
---

# Generator API Review

Review Generator API code or diffs for concrete correctness defects, architectural boundary violations, resource lifecycle bugs, and unnecessary maintenance complexity while keeping the review strictly read-only.

## When to Use

- Reviewing a git diff, pull request, module, execution flow, or the full Generator API repository
- Auditing routes, schemas, report definitions, services, or PPTX utilities for correctness and maintainability
- Evaluating proposed changes before merging or refactoring without modifying files

## Steps

### 1. Establish Review Scope and Context

1. Read the repository's `AGENTS.md` to load architectural invariants, boundary rules, and verification policies.
2. Restrict your review to the scope requested by the user (diff, module, flow, or repository). When reviewing a diff, inspect surrounding context and affected callers rather than launching an unrelated repository-wide audit.
3. Keep the review strictly read-only unless the user explicitly asks you to apply fixes.

### 2. Audit High-Impact Defect and Maintenance Areas

Prioritize concrete bugs and maintenance costs demonstrated by the code within the reviewed scope:

- **HTTP & Contract Drift:** Disagreements between HTTP decoding, route schemas, and service contracts; unintended divergence between `GET` and `POST` handlers; unexpected changes to defaults, `HEAD` behavior, error status codes/payloads, or download metadata.
- **Concurrency, Timeouts & Resource Lifecycles:** Timeout, cancellation, or shutdown paths that leak timers, event listeners, or temporary resources, or release a concurrency/rendering queue slot before the underlying task actually finishes.
- **PPTX & Document Integrity:** PPTX changes that update chart XML without updating the corresponding embedded workbook or relationships, strip chart/slide editability, or mutate a shared in-memory/source template.
- **Architectural Boundary Leaks:** Report-specific configuration leaking into global wiring or central conditionals; route handlers taking ownership of validation, service orchestration, and low-level document manipulation instead of delegating properly.
- **Unjustified Indirection & Dead Abstractions:** Wrappers, configurable abstractions, dependencies, or exports that add maintenance overhead without serving a concrete caller or requirement.
- **Harmful Duplication vs. Wrong Abstraction:** Duplicated business rules that have already drifted out of sync, or forced shared helpers that obscure genuinely different PDF vs. PPTX semantics.

### 3. Gather Evidence and Verify Conservatively

1. Trace each suspected issue through its callers and data/resource lifecycle until the failure mode or maintenance cost is proven.
2. Check dynamic route/report discovery and `package.json` entry points before flagging any export, file, or dependency as unused. Treat the implementation as the source of truth (using existing tests and docs only to clarify intent).
3. Run static checks (such as type checking, linting, or Knip per `AGENTS.md`) only when they directly resolve a concrete review question or when requested by the user.
4. Do not add or run tests, execute test-bearing verification scripts, or generate build/report artifacts by default.
5. If a potential runtime issue cannot be proven statically, classify it as an **Open Question** and specify what runtime observation would confirm or rule it out—never present an unverified suspicion as a confirmed defect.

### 4. Format and Report Actionable Findings

1. Order confirmed findings by severity and impact (highest impact first).
2. For each confirmed finding, provide:
   - **Location:** Exact file path and line numbers
   - **Trigger / Cost:** The specific input, lifecycle event, or maintenance scenario that exposes the issue
   - **Effect:** The resulting bug, resource leak, contract break, or maintenance burden
   - **Minimal Fix:** The smallest local change that resolves the issue (avoid proposing broad redesigns when a targeted fix suffices)
3. Separate any minor stylistic or non-blocking observations from confirmed defects.
4. If no confirmed issues exist, state that clearly without inventing filler findings.
5. Conclude with a brief summary of the reviewed scope, which static checks (if any) were executed, and any remaining runtime uncertainties—without claiming that zero findings guarantees runtime correctness.

## Gotchas

- **Prettier and style noise:** Do not flag formatting preferences handled by Prettier, arbitrary file/function line counts, or missing unit tests as review defects.
- **False-positive dead code:** Never claim a route handler (`get.ts`, `post.ts`), schema, report module, or standalone script is unused based solely on static import searches; verify dynamic discovery first.
- **Silent side effects during review:** Do not mutate code, format files, or run test suites during a review unless explicitly asked.