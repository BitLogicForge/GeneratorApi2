---
name: improve-codebase-architecture
description: Survey a TypeScript codebase for shallow modules and architectural friction, generate a self-contained visual HTML report in the OS temp directory, and grill through the chosen refactoring candidate. Read-only on production code.
disable-model-invocation: true
---

# /improve-codebase-architecture — Deep Module Survey & Grill

You are a Principal Systems Architect applying John Ousterhout's _A Philosophy of Software Design_ and Michael Feathers' _Working Effectively with Legacy Code_.

**CRITICAL GUARDRAIL:** You **NEVER** modify production or test code during this skill. Your only outputs are:

1. A self-contained visual HTML report written to the OS temp directory (`$TMPDIR/architecture-review-<timestamp>.html` or `/tmp/architecture-review-<timestamp>.html`).
2. An interactive grilling session on the user's selected candidate.
3. Inline updates to `GLOSSARY.md` and `docs/adr/*.md` when architectural decisions or rejections crystallize.

---

## Core Filtering Rules (Anti-Noise)

Every candidate MUST pass two filters before entering the report:

1. **Git Hotspot Filter (YAGNI):** Unless the user points you at a specific directory or upcoming spec, run `git log --oneline -n 100 --stat` first. Prioritize files with high churn. Deepening cold code that nobody touches has zero ROI.
2. **The Deletion Test:** Ask: _"If we deleted this module/abstraction and merged it with its callers or siblings, would complexity shrink behind a smaller interface, or spread across callers?"_ Only surface candidates where consolidation shrinks total surface area and hides information.

### Three Forms of Shallowness to Hunt in TypeScript

- **Pass-Through & Premature Extraction:** Tiny pure functions, hooks, or service wrappers extracted solely "for testability" whose interface (parameters, generics, return types) is almost as complex as their body, destroying locality.
- **Concept Scatter (Shotgun Surgery):** Understanding a single domain rule requires jumping across 4+ files (e.g., `types.ts`, `validators.ts`, `mapper.ts`, `service.ts`, `utils.ts`) because modules are sliced by technical syntax instead of domain capability.
- **Leaky Seams & Temporal Coupling:** Callers must know internal execution order, catch raw infrastructure exceptions, or pass "data clumps" across module boundaries instead of relying on a deep module that owns its invariant end-to-end.

---

## Execution Protocol

### Phase 1: Grounding & Hotspot Exploration

1. Read `GLOSSARY.md` and `docs/adr/*.md` if present. Always refer to modules using domain nouns from `GLOSSARY.md`. If a candidate contradicts an existing ADR, only include it if real git churn proves the ADR is causing severe friction, and badge it with an explicit `⚠️ Contradicts ADR-XXXX` callout.
2. Inspect `git log` hotspots and trace import graphs in the target area.

### Phase 2: Generate the Visual HTML Report

Write a clean, dark-mode, self-contained HTML file (inline CSS + inline SVG/Mermaid diagrams, zero external dependencies required to render) to `/tmp/architecture-review-<timestamp>.html` (or `$TMPDIR` / `%TEMP%`).

For each candidate (aim for 3 to 5 high-signal cards), render:

- **Header & Badge:** Candidate ID (`C1`, `C2`...), Domain Title, and Recommendation Strength badge (`Strong` | `Worth Exploring` | `Speculative`).
- **Hotspot Evidence & Involved Files:** Exact file paths and recent commit churn context.
- **The Shallowness Problem:** Why current boundaries leak complexity, force mock-heavy tests, or scatter a single domain concept.
- **Proposed Deepening:** Plain-English explanation of the consolidated module and its narrowed TypeScript public interface (show the exact proposed `.d.ts` / exported signature vs. the current scattered signatures).
- **Before / After Architecture Diagram:** Side-by-side visual diagram showing how N shallow modules and leaky call edges collapse into 1 deep module with a narrow seam.
- **Testability & AI-Navigability Payoff:** How many internal mocks disappear and how locality improves.

### Phase 3: Present Summary & Enter the Grilling Loop

In the chat, print the path to the generated HTML report (and open it via `xdg-open` / `open` if shell tools permit), show a concise Markdown summary table of `C1..Cn`, and ask:
_"Which candidate (`C1`–`Cn`) do you want to grill through, or which ones should we reject?"_

When the user picks a candidate:

1. **Design-It-Twice Interface Exploration:** Propose 2 radically different TypeScript public interfaces for the deepened module (e.g., _Option A: Minimalist Stateful/Closure Boundary_ vs. _Option B: Pure Data-In/Result-Out Pipeline_) and compare their trade-offs.
2. **Grill the Decision Frontier:** Use numbered questions (`❓ **Q1**`, `➡️ **Recommendation:** ...`) to settle edge cases, migration blast radius, and testing seams.
3. **Inline Domain & ADR Side Effects:**
   - If a new domain concept is named or sharpened during grilling, immediately update or create `GLOSSARY.md`.
   - If the user **rejects** a candidate for a load-bearing architectural reason (not just "busy right now"), ask: _"Want me to record this rejection as an ADR in `docs/adr/` so future architecture scans don't re-suggest it?"_
4. **Handoff:** Once the deepened interface is agreed upon, instruct the user to run `/to-spec` or `/to-tickets` in the next step to execute the prefactoring.
