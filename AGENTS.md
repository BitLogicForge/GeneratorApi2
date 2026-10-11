# Agent instructions

## Project purpose

Generator API is a TypeScript + Express application that generates PDFs from a
webapp and editable PowerPoint presentations. It requires Node.js 22+ and uses
Playwright, PptxGenJS, JSZip, and Zod. Tests run with `node:test` through `tsx`;
Supertest verifies HTTP contracts.

## Where to look

Start with `package.json` and the “Where to look” section in `README.md`.
The following map identifies the main areas of responsibility:

| Area                                                            | Files                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Startup, dependency wiring, and shutdown                        | `src/index.ts`                                                             |
| Express, middleware, and request IDs                            | `src/app.ts`                                                               |
| Configuration and limits                                        | `src/config.ts`                                                            |
| Input validation and document routes                            | `src/routes/**/schema.ts`, `src/validation/`                               |
| Endpoints                                                       | `src/routes/` (folders define URLs; `get.ts` and `post.ts` define methods) |
| Service contracts, GET decoding, downloads, and errors          | `src/http/`, `src/errors.ts`                                               |
| Queues, timeouts, and cancellation of waiting jobs              | `src/queue/generation-queue.ts`                                            |
| Chromium and PDF rendering                                      | `src/services/pdf/web-page-pdf.ts`                                         |
| Presentation generation and template filling                    | `src/services/pptxgenjs/`, `src/services/jszip/`                           |
| Presentation designs and types                                  | `src/pptx/pptxgenjs/`                                                      |
| PPTX XML, relationships, tables, charts, and embedded workbooks | `src/pptx/jszip/`                                                          |
| Data API endpoint configuration and response types              | `src/data-api/endpoints.ts`, `src/data-api/report-data-schema.ts`          |
| Source presentations                                            | `templates/`                                                               |
| Tests and examples                                              | `test/`, `examples/`                                                       |
| API and deployment documentation                                | `docs/endpoints.md`, `docs/azure.md`, `scripts/`                           |

## Investigating the code

- Find filenames with `rg --files`, search content with `rg -n`, and list only
  matching filenames with `rg -l`. Start in the relevant directory and expand
  the scope when results are insufficient.
- Respect `.gitignore`. Exclude `node_modules`, `dist`, `output`, and binary
  artifacts from routine searches. Read templates and generated documents when
  the task requires them.
- Read specific functions and nearby context rather than the entire repository.
  Batch independent reads; choose subsequent investigation steps based on results.
- For HTTP behavior, trace: endpoint → input decoding → Zod schema → queue and
  service → response or error → tests.
- Before changing a shared function or type, find its callers, implementations,
  and related tests. Check both GET and POST when they share logic.
- Distinguish confirmed issues from hypotheses. Reference specific files and
  lines in analysis and explain the effect on application behavior.
- Code is the source of truth. Correct outdated documentation within the scope
  of the task.

## Change guidelines

- Preserve the existing TypeScript ESM style, including `.ts` extensions in local
  TypeScript source imports. For distant modules, use `@/` (the `src/` directory)
  or `@examples/` without extensions. The build rewrites imports to `.js` in
  `dist`. Leave formatting to Prettier.
- Keep routing, validation, and document generation separate. Use service
  injection through `createApp` and contracts in `src/http/types.ts` so HTTP
  tests do not require real Chromium.
- Preserve existing GET/POST contracts, download headers, request IDs, and error
  structures unless the task requires changing them.
- Do not bypass PDF route validation, navigation restrictions, the template
  registry, or queue limits. An active job occupies its slot until it actually
  finishes; cancelling a wait does not mean active rendering has finished.
- Preserve editability and formatting when changing PPTX generation. Update
  chart data together with the embedded workbook and relevant relationships.
  Generation must not modify the source presentation.
- Do not read or print secrets from `.env` or credential files. Use `.env.example`
  and variable names when documenting configuration.
- Keep changes within the task's scope. Add dependencies when existing tools
  cannot reasonably solve the problem; avoid incidental formatting of other files.
- When changing endpoint parameters or behavior, update `docs/endpoints.md` and,
  when needed, examples and `README.md`.

## Verification

Run `npm run knip` after changing code, exports, dependencies, or entry points.
Knip checks unused files, exports, and dependencies. Add new standalone entry
points that are not recognized from npm scripts to `entry` in `knip.json`.
Do not suppress findings without checking whether the reported code is used.

Choose checks appropriate to the change. Check `package.json` for available commands.

| Change                              | Verification                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| TypeScript                          | `npm run typecheck` and relevant tests                                             |
| Single module                       | `npx --no-install tsx --test test/http/api.test.ts` (substitute the relevant file) |
| Shared logic, routing, or contracts | `npm test`                                                                         |
| Formatting a changed file           | `npx --no-install prettier --check AGENTS.md` (substitute the relevant path)       |
| Formatting the entire project       | `npm run format:check`                                                             |
| Compilation and running from `dist` | `npm run build`                                                                    |
| Azure packaging                     | `npm run test:azure`; see `docs/azure.md`                                          |
| Document appearance                 | `npm run test:outputs` and inspection of the relevant artifacts                    |

- For behavior changes or bug fixes, add a test that verifies an observable
  result. Do not add tests that merely reproduce the implementation.
- PDF rendering tests require Chromium and its system libraries.
  `npm run browser:install` installs the browser and its dependencies.
- HTTP tests should cover relevant statuses, headers, validation, and errors.
  PPTX tests should verify the relevant ZIP/XML parts and document data.
- For documentation-only changes, checking correctness and formatting is sufficient.
- In the summary, report the result, checks performed, and any blockers.
  Do not claim that tests passed unless they were run.
