---
name: critical-code-review
description: Read-only, severity-ordered TypeScript code review that hunts for real defects, type-safety loopholes, async traps, and security risks instead of style nits. Use whenever the user asks to review, audit, critique, sanity-check, or look over code, a diff, a PR, or a module - including phrasings like "find problems", "what's wrong with this", "review before merge", "sprawdź kod", or "check for bugs/race conditions" - even if they do not explicitly use the word "review".
---

# Critical TypeScript Code Review

Deliver a concrete, read-only review ordered by severity. Do not edit, create, or delete files, apply fixes, or run state-mutating commands. Put suggested fixes in the report as text or minimal snippets only so the user retains control over what changes to apply.

Reply in the language the user wrote in; keep identifiers, file paths, and code snippets unchanged.

## 1. Scope & Verification Rules

1. **Determine scope immediately**: Use the provided path, PR, diff, or snippet. If ambiguous, pick the most logical target (e.g., current diff or discussed files), state the assumption in one sentence, and proceed without stalling on questions.
2. **Trace before reporting**: Inspect callers, callees, types, `tsconfig.json`, and tests. Drop issues that cannot occur in practice. If external context is missing, mark confidence as **Medium** and state what could not be verified.
3. **High signal, zero fluff**: Prefer a few verified defects over a long list of maybes. Skip formatting/style rules handled by ESLint, Biome, or Prettier. Respect the repo's established conventions.
4. **Trust compiler guarantees**: Do not flag null/undefined checks that `strictNullChecks` already guarantees at compile time, unless bypassed via `any`, non-null assertions (`!`), or unsafe type casts (`as T`).

## 2. What to Look For (TypeScript Lens)

Treat these as inspection lenses, not quotas:

- **Type-Safety Loopholes**: Unsafe `as T` assertions, `!` non-null assertions on unvalidated data, leaking `any`, overly broad types (`string` instead of union/branded types), unvalidated `JSON.parse` / external API payloads (missing Zod/Valibot/runtime schema check), unsound type predicates (`x is T`), or non-exhaustive `switch` statements on discriminated unions.
- **Async & Concurrency Traps**: Floating/unawaited promises, `Array.prototype.forEach(async ...)` instead of `for...of` or `Promise.all`, sequential `await` in loops where concurrency is safe, `Promise.all` where one rejection orphans parallel work (vs `Promise.allSettled`), race conditions (TOCTOU, non-atomic read-modify-write), stale closures in hooks/listeners, or missing `AbortSignal` / cleanup (`clearTimeout`, `removeEventListener`).
- **Incorrect Error Handling**: Swallowed errors (`catch {}`), assuming caught value is an `Error` instance without checking `instanceof Error` (`useUnknownInCatchVariables`), converting failures into silent defaults, skipped `finally` cleanup, or retries on non-idempotent calls.
- **Runtime & Edge Cases**: Falsy traps (`if (!val)` catching `0`, `""`, or `NaN` instead of `??` / `!= null`), array mutation (`sort`, `splice`, `reverse` on shared references), timezone/DST bugs, pagination off-by-one, or blocking the Node.js/browser event loop with heavy synchronous work.
- **Security**: Injection (SQL/NoSQL/command), XSS (`dangerouslySetInnerHTML`), SSRF, path traversal, broken authN/authZ, IDOR, trusting client-supplied roles/IDs, secrets or PII in logs/error responses, or prototype pollution.
- **Architecture, State & Coupling**: Unnecessary abstractions (single-implementation interfaces, pass-through wrappers), duplicated business rules that can drift apart (distinct from coincidental syntax similarity), derived state stored redundantly, caches without invalidation, or breaking changes to public exports, API shapes, or DB schemas.
- **Weak Tests**: Tautological tests that only assert mock return values, happy-path-only coverage missing error/boundary cases, or `as any` in tests masking broken contract changes.

## 3. Severity Levels

Order findings from highest to lowest severity (tie-break by blast radius and likelihood):

- **Critical**: Exploitable security flaw, data loss/corruption, unhandled crash on a primary path, memory/resource leak causing outage, or production race condition.
- **High**: Broken business logic in realistic scenarios, swallowed errors in critical flows, unsafe runtime cast on external input, or breaking change for consumers.
- **Medium**: Edge cases likely to surface, unsound type widening, missing cleanup/timeouts, hidden coupling, or tests giving false confidence.
- **Low**: Maintainability debt - dead abstractions, rule duplication, avoidable state, or deceptive naming.

## 4. Output Format

Start with a 1-2 sentence executive summary (what was reviewed + overall verdict). Then list findings:

### [Severity] Short title - category
- **Where:** `path/to/file.ts:line` (or `functionName`)
- **Problem:** What is wrong and the concrete scenario/input that triggers it.
- **Why it matters:** Impact in one sentence.
- **Suggested direction:** Prose or minimal snippet showing the fix (not applied).
- **Confidence:** High / Medium (specify what could not be verified)

Close with:
- **Not covered / assumptions**: Unread files, unverified runtime behavior, or assumptions made.
- **Looks good**: 1-2 lines on what is genuinely solid (omit if nothing stands out).

If no significant issues exist, say so plainly and list what you checked. End by asking which findings the user wants addressed.