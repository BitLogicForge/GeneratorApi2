# Agent Instructions

## Project Overview

Generator API is a Node.js 22+ TypeScript and Express service that renders PDFs
from a webapp (Playwright) and generates editable PowerPoint presentations
(PptxGenJS and JSZip) with Zod validation.

## Where to Look

| Area                                        | Files                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Startup, dependency wiring, and shutdown    | `src/index.ts`, `src/runtime.ts`, `src/app.ts`                                             |
| Configuration and print settings            | `src/config/`, `src/services/pdf/schema.ts`                                                |
| Explicit Express routes and report handlers | `src/routes/router.ts`, `src/routes/**/{report,schema}.ts`, `src/reports/`                 |
| HTTP decoding, downloads, errors, metrics   | `src/http/`, `src/errors.ts`, `src/observability/`                                         |
| Admission queues, timeouts, cancellation    | `src/queue/generation-queue.ts`                                                            |
| Chromium lifecycle and PDF rendering        | `src/services/pdf/web-page-pdf.ts`, `src/services/pdf/render-page.ts`                      |
| PPTX services and template loading          | `src/services/jszip/`, `src/services/pptxgenjs/`                                           |
| PPTX XML, charts, tables, slides, workbooks | `src/pptx/jszip/`, `src/pptx/pptxgenjs/`                                                   |
| Data API client and endpoint schemas        | `src/services/data-api-client.ts`, `src/services/data-api/`, `src/data-api/`               |
| Templates, tests, examples, and docs        | `templates/`, `test/`, `examples/`, `docs/guides/endpoints.md`, `docs/deployment/azure.md` |

## Project Invariants

- **Imports & Formatting**: Use `.ts` extensions for relative imports and
  extensionless `@/` or `@examples/` aliases for distant modules (`dist`
  compiles to `.js`). Leave formatting to Prettier.
- **Module Design**: Prefer small, human-readable files with one distinct
  responsibility. Keep routing, validation, service orchestration, and document
  manipulation separate.
- **HTTP & Security Boundaries**: Preserve GET/POST/HEAD contracts, download
  headers, request IDs, and error shapes unless asked to change them. Never
  bypass PDF navigation restrictions, the template registry, or queue limits.
- **Queue Ownership**: Cancelling a queued wait evicts only the pending job; an
  active job keeps its concurrency slot until rendering finishes.
- **PPTX Integrity**: Preserve native editability and styling. Synchronize chart
  caches, formulas, embedded workbooks, and relationships together. Never
  mutate source files in `templates/`.
- **Secrets & Docs**: Never read or print `.env` secrets (use `.env.example`).
  Update `docs/guides/endpoints.md` (and `README.md` / `examples/` when needed)
  whenever endpoint contracts change.

## Verification

Prefer static checks. **Do not add or run tests** (or aggregate scripts like
`npm run verify:ci` / `npm run deps:verify`, browser installs, or artifact
generators) unless the user explicitly asks for tests.

| Change                     | Verification Command                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| TypeScript / exports       | `npm run typecheck`, `npm run lint:code`, `npm run knip`                      |
| Single file formatting     | `npx --no-install prettier --check <path>`                                    |
| Project-wide formatting    | `npm run format:check`                                                        |
| Build / `dist` compilation | `npm run build`                                                               |
| Single test (when asked)   | `npx --no-install tsx --test test/date-time.test.ts` (substitute target file) |

Add new standalone entry points not referenced in `package.json` to `knip.json`
rather than suppressing Knip findings. Stop once relevant checks pass, and never
claim runtime behavior was tested when only static checks ran.

## Project Skills

Load only the skill matching the current task:

| Task                        | Skill                                                  |
| --------------------------- | ------------------------------------------------------ |
| Implement features or fixes | [code-quality](.agents/skills/code-quality/SKILL.md)   |
| Simplify or reorganize code | [code-refactor](.agents/skills/code-refactor/SKILL.md) |
| Review code or a change     | [code-review](.agents/skills/code-review/SKILL.md)     |
