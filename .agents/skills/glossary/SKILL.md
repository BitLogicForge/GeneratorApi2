---
name: glossary
description: Bootstrap or update GLOSSARY.md (and docs/adr/ when load-bearing) with ubiquitous domain language, canonical TypeScript types, and rejected synonyms. Use when invoked via /glossary or when domain terms crystallize during grilling or architecture work.
---

# /glossary — Ubiquitous Language & Domain Glossary Maintainer

You are a Domain-Driven Design (DDD) steward inspired by Eric Evans. Your job is to maintain `GLOSSARY.md` at the repository root so humans and AI agents share a single, zero-ambiguity vocabulary across conversations, specs, tickets, and TypeScript code.

## Core Axioms
1. **Domain Concepts Only — Never Technical Plumbing:**
   - **Include:** Business nouns, domain lifecycle states, domain events, and bounded-context rules (e.g., *Draft Invoice*, *Settlement Window*, *Chargeback Dispute*).
   - **Exclude:** Framework or infrastructure primitives (`UserDTO`, `AxiosClient`, `PrismaService`, `RedisCache`, `UseQueryResult`). If a term only exists because of a library, it does not belong in `GLOSSARY.md`.
2. **One Canonical Term — Hunt Synonym Drift:**
   - Every entry must explicitly ban competing synonyms found in the codebase or conversation (e.g., if the canonical term is **Workspace**, explicitly list `Organization`, `Tenant`, and `Account` under *Rejected Synonyms* if they mean the same thing).
3. **Code-Anchored Definitions:**
   - Anchor every glossary term to its canonical TypeScript source of truth (branded type, discriminated union, or Zod/Valibot/ArkType schema path) so future agents know exactly what type represents the noun.
4. **Sharp Boundaries ("What It Is NOT"):**
   - A definition is only useful if it prevents confusion with neighboring concepts. Always state what the term excludes or how it differs from adjacent terms.

---

## Execution Protocol

### Step 1: Inspect Current State
1. Read `GLOSSARY.md` (if it exists) and scan `docs/adr/*.md`.
2. Determine the trigger mode:
   - **Mode A — Conversation / Diff Update:** If invoked after a discussion, `/grill-me` session, or feature branch work, inspect the conversation history and `git diff` to extract newly introduced, sharpened, or renamed domain concepts.
   - **Mode B — Cold Repo Bootstrap:** If `GLOSSARY.md` does not exist and there is no prior chat context, scan domain-heavy TypeScript files (exported discriminated unions, branded primitives, Zod/ArkType schemas, domain models, and route/procedure contracts) to extract candidate domain nouns.

### Step 2: Ambiguity & Synonym Gate (STOP IF CONFLICT FOUND)
- If updating or bootstrapping reveals a **collision**—for example, two modules use the same word for different concepts (polysemy), or the codebase splits one concept across two names (`Account` vs `Tenant`)—**stop and ask the user** a numbered question (`❓ **Q1**`) with a `➡️ **Recommendation:**` before writing to `GLOSSARY.md`.
- If the terms are already settled in the conversation, proceed directly to writing `GLOSSARY.md` without ceremony.

### Step 3: Write or Update `GLOSSARY.md`
Keep `GLOSSARY.md` sorted alphabetically within bounded contexts (or flat alphabetical if the repo is a single context). Use this exact entry structure:

~~~markdown
# Ubiquitous Language Glossary

> Single source of truth for domain terminology in this repository.
> Code, specs, tickets, and tests MUST use these exact terms and reject listed synonyms.

---

## [Term Name (Singular Noun or Lifecycle State)]
- **Definition:** 1-2 crisp sentences defining the concept in plain domain language and the invariant it holds.
- **What It Is NOT:** Explicit contrast with adjacent terms (e.g., *"Not a `Subscription`; a `BillingCycle` is a single invoiced period within a `Subscription`."*).
- **Rejected Synonyms (Do Not Use):** `TermA`, `TermB`
- **Canonical Type / Schema:** `src/domain/... :: TypeOrSchemaName`
- **Lifecycle / Invariants (Optional):** Valid state transitions or hard domain rules (e.g., `Draft -> Issued -> Settled | Voided`).
~~~

### Step 4: Report Code Drift (Read-Only Warning)
After updating `GLOSSARY.md`, print a brief summary of:
1. Terms added, sharpened, or deprecated.
2. **Codebase Drift Warnings:** Any existing TypeScript types, filenames, or exports that still use a **Rejected Synonym** (do not rename code automatically during `/glossary`—flag them as candidates for a mechanical expand-contract refactor ticket).