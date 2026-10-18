---
name: to-tickets
description: Decompose a specification or conversation plan into vertical tracer-bullet tickets with explicit blocking edges, prefactoring steps, and context-window sizing.
disable-model-invocation: true
---

# /to-tickets — Tracer-Bullet Work Graph Generator

You decompose complex engineering specs into agent-ready tickets. Every ticket must be executable by a fresh AI session that has never seen the prior conversation.

## Core Axioms
1. **Vertical Tracer Bullets, NEVER Horizontal Layers:**
   - **Forbidden:** Ticket 1: DB Schema -> Ticket 2: Repository/API -> Ticket 3: UI -> Ticket 4: Tests. Horizontal slicing hides integration defects until the end and forces tickets to grade work they don't own.
   - **Required:** Each ticket cuts a narrow, complete path through **every layer** (types/schema -> domain logic -> API/UI -> seam tests) that can be verified and demoed independently on green CI.
2. **Prefactor First ("Make the change easy, then make the easy change"):**
   - Inspect the codebase for structural friction. If a module needs deepening or a seam needs extracting before feature slices can land cleanly, schedule a **Prefactor Ticket** at the root of the dependency graph.
3. **Exception — Wide Mechanical Refactors (Expand–Contract):**
   - If a change is a wide mechanical refactor (renaming a core symbol or changing a shared type across dozens of files), do not force a vertical slice. Sequence it as:
     1. **Expand:** Add new type/signature alongside the old one (CI stays green).
     2. **Migrate (Batched):** Migrate callers per bounded module/directory (blocked by Expand).
     3. **Contract:** Remove deprecated symbol/type (blocked by all Migrate tickets).
4. **Single-Context Sizing:**
   - Size every ticket so an agent can read the context, run `/tdd`, and pass `/code-review` within a single fresh context window without compaction.

---

## Execution Protocol

### Step 1: Context & Codebase Inspection
- Read the input spec (file path, issue, or conversation thread), `GLOSSARY.md`, and `docs/adr/`.
- Inspect the target files in the repository to map real file paths, dependency boundaries, and prefactoring needs.

### Step 2: Draft the DAG & Quiz the User (STOP & CONFIRM)
Do **not** write ticket files or publish to the tracker yet. Present the proposed work graph as a numbered list:

For each proposed ticket, display:
- **`#N` Title:** Action-oriented title using `GLOSSARY.md` nouns.
- **Type:** `Prefactor` | `Tracer Bullet` | `Expand-Contract`
- **Blocked by:** Exact ticket numbers (`None` if on the immediate execution frontier).
- **End-to-End Deliverable:** What observable behavior works and passes CI when this lands.
- **Owned Files / Subsystem:** Blast radius for parallel safety.

Then ask the user these three confirmation questions:
1. *Does the granularity feel right for single-session execution (anything too coarse or too fine)?*
2. *Are the `Blocked by` edges strictly minimal (only true hard dependencies)?*
3. *Should any slices be merged, split, or re-ordered?*

Iterate until the user explicitly approves the graph.

### Step 3: Publish Self-Contained Tickets
Once approved, write each ticket to `.scratch/issues/<NN>-<slug>.md` (or publish to the configured GitHub/Linear tracker with native blocking links) using this exact template:

~~~markdown
# [Ticket #NN]: [Title]

- **Source Spec:** [Path or Issue Ref]
- **Blocked By:** [Ticket IDs or None]
- **Blocks:** [Ticket IDs or None]
- **Owned Subsystem / Paths:** `[glob/paths]`

## Context & Objective
Self-contained summary of what this slice delivers and why, written for an agent with zero prior chat context.

## Vertical Slice Scope
- **Types / Schema Boundary:** Exact TS types / runtime schemas added or updated.
- **Module / Domain Logic:** Deep module behavior implemented.
- **Integration / UI / API:** End-to-end wiring.

## Verification Seam & TDD Contract
- **Target Seam:** `[Exact exported function/component/endpoint]`
- **Required Behavioral Tests:**
  - [ ] Happy path tracer assertion
  - [ ] Edge case / failure union assertions
- **Verification Commands:** `pnpm tsc --noEmit && pnpm vitest run [path]`

## Prohibited Shortcuts
- No horizontal half-implementations (unwired dead code or `TODO` stubs).
- No `as any`, `@ts-ignore`, or unvalidated `unknown` casts.
- Do not mock internal private functions inside the target module.
~~~