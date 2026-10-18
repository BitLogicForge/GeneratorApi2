# Agent Instructions

## Overview & Code Map

Generator API is a Node.js 22+ TypeScript and Express service that renders
webapp PDFs (Playwright) and editable PowerPoint presentations (PptxGenJS and
JSZip) with Zod validation.

- **Runtime & HTTP**: `src/index.ts`, `src/runtime.ts`, `src/app.ts`, `src/http/`, `src/errors.ts`, `src/observability/`
- **Config, Queues & Utils**: `src/config/`, `src/queue/generation-queue.ts`, `src/utils/`, `src/validation/`
- **Routes & Reports**: `src/routes/router.ts`, `src/routes/**/{report,schema}.ts`, `src/reports/`
- **PDF & Data API**: `src/services/pdf/`, `src/services/data-api-client.ts`, `src/services/data-api/`, `src/data-api/`
- **PPTX**: `src/services/jszip/`, `src/services/pptxgenjs/`, `src/pptx/jszip/`, `src/pptx/pptxgenjs/`, `templates/`
- **Docs, Examples & Tests**: `docs/guides/endpoints.md`, `docs/deployment/azure.md`, `examples/`, `test/`

## Core Rules

- **Imports & Formatting**: Use `.ts` extensions for relative imports and
  extensionless `@/` or `@examples/` aliases for distant modules (`dist`
  compiles to `.js`). Leave formatting to Prettier.
- **Module Design**: Prefer small, human-readable files with one distinct
  responsibility. Keep routing, validation, service orchestration, and document
  manipulation separate.
- **Safety & Secrets**: Never read or print `.env` secrets (use `.env.example`).
  Never mutate files in `templates/`, bypass origin/template boundaries, or
  release an active queue slot before rendering finishes.

## Verification

Prefer static checks. **Do not add or run tests** (or aggregate scripts like
`npm run verify:ci` / `npm run deps:verify`, browser installs, or artifact
generators) unless explicitly requested.

- **TypeScript / Exports**: `npm run typecheck`, `npm run lint:code`, `npm run knip` (add new standalone entry points to `knip.json`)
- **Formatting**: `npx --no-install prettier --check <path>` (or `npm run format:check`)
- **Build**: `npm run build`
- **Single Test (only when asked)**: `npx --no-install tsx --test <test-file>`
