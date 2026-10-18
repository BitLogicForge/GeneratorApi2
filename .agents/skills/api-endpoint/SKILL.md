---
name: api-endpoint
description: Design, implement, and update Express and Zod HTTP endpoints, request decoders, download handlers, and upstream API clients. Use when adding or modifying routes, request/response schemas, query/body decoding, admission queueing, error handling, or endpoint documentation.
---

# HTTP Endpoint & Schema Design Guide

Read the repository's [AGENTS.md](../../../AGENTS.md) before making changes.
Keep HTTP transport decoding, Zod schema validation, queue admission, and
service execution in separate, single-responsibility modules.

## Keep Transport and Validation Explicit

- **Route Registration & Ownership**: Register Express routes explicitly in the
  router, and keep route-specific Zod schemas, input preparation, and output
  filenames colocated with the route/report definition rather than growing
  central conditionals or global dependency types.
- **GET, POST, and HEAD Parity**: When an endpoint supports both query-string
  and JSON-body inputs, decode declared JSON query fields explicitly and validate
  both through the same strict Zod schema (`.strict()`). Ensure `HEAD` requests
  validate parameters and return identical download headers (`Content-Type`,
  `Content-Disposition`, `Cache-Control: no-store`) without running expensive
  generation.
- **Security & Input Boundaries**: Reject control characters, path traversal,
  unexpected query arrays, and untrusted origins/paths at the schema boundary.
  Never allow request parameters to select arbitrary filesystem paths or bypass
  upstream URL prefix restrictions.

## Preserve Queue, Error, and Documentation Contracts

- **Admission & Cancellation**: Route generation work through the appropriate
  admission queue. If the client disconnects before generation finishes, abort
  the queued wait via `AbortController` without releasing the concurrency slot
  of an already-running job.
- **Error Mapping**: Throw typed application or Zod errors so the central error
  middleware returns consistent `{ error: { code, message, requestId } }`
  payloads and sets `Retry-After` on `503` responses without leaking internal
  stack traces.
- **Documentation Sync**: Whenever an endpoint's path, method, parameters,
  defaults, or error codes change, update the endpoint documentation and
  relevant examples in the same change.

## Verify Proportionally

Run the static checks in `AGENTS.md` (`typecheck`, `lint:code`, `knip`, and
Prettier on changed files). Do not add or run HTTP tests unless the user
explicitly asks for tests.
