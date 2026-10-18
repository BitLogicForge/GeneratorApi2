---
name: test-verification
description: Write and run focused TypeScript tests with node:test and tsx when explicitly requested by the user. Use only when asked to add, update, debug, or execute unit, integration, HTTP, or document generation tests.
---

# Test Authoring & Verification Guide

Read the repository's [AGENTS.md](../../../AGENTS.md). **Only use this skill
when the user explicitly requests adding, updating, or running tests** (or asks
for full CI verification). Never add or run tests automatically during ordinary
feature, bug-fix, refactor, or review tasks.

## Test Observable Behavior, Not Implementation Details

- **Contract-Focused Assertions**: Use Node's built-in `node:test` runner and
  `node:assert/strict`. Assert observable inputs and outputs: HTTP status codes,
  download headers, structured error payloads, or parsed ZIP/XML document state.
  Do not write brittle tests that mirror internal helper structure or private
  collaborators.
- **Fast, Isolated Execution**: Keep HTTP and service tests free of real
  Chromium launches or external network calls unless testing browser integration
  specifically. Inject mock services or use service registry overrides and
  ephemeral local servers/temp directories (`mkdtemp`) so tests are fast and
  deterministic.
- **Self-Contained Fixtures**: Build minimal in-memory fixtures (such as small
  JSZip archives or schema-valid payloads) directly in the test file when testing
  edge cases and validation failures, and clean up any temporary resources on
  completion.

## Run the Smallest Relevant Scope

- **Targeted Execution**: Prefer running the single relevant test file first via
  `npx --no-install tsx --test <path-to-test.ts>` before running broader suites
  like `npm run test:jszip` or `npm test`.
- **Browser Dependencies**: Playwright PDF integration tests require Chromium
  (`npm run browser:install`); run them only when the user asks to verify live
  browser rendering.
- **Static Hygiene**: Ensure new or modified test files also pass
  `npm run typecheck`, `npm run lint:code`, `npm run knip`, and Prettier.
