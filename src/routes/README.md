# File-based routes

PowerPoint API routes are grouped by engine: `api/exports/pptx/jszip/`
contains existing-file templates (`business`, `summary`, and `daa`), and
`api/exports/pptx/pptxgenjs/` contains code-generated designs (`brief`).

Folders define the URL. Lowercase method files define the HTTP method:

| File                                      | Endpoint                                |
| ----------------------------------------- | --------------------------------------- |
| `health/get.ts`                           | `GET /health`                           |
| `api/exports/pdf/post.ts`                 | `POST /api/exports/pdf`                 |
| `api/exports/pptx/pptxgenjs/brief/get.ts` | `GET /api/exports/pptx/pptxgenjs/brief` |
| `api/exports/pptx/jszip/business/post.ts` | `POST /api/exports/pptx/jszip/business` |
| `[id].pdf/get.ts`                         | `GET /:id.pdf`                          |
| `api/exports/pptx/jszip/daa/get.ts`       | `GET /api/exports/pptx/jszip/daa`       |
| `get.ts`                                  | `GET /` (if added)                      |

Supported filenames: `get.ts`, `post.ts`, `put.ts`, `patch.ts`, `delete.ts`,
`head.ts`, `options.ts`. `[name]` becomes a named parameter; suffixes such as
`[id].pdf` are supported. Use letters, numbers, underscores, dots and hyphens for
static folder names. Parameter names start with a letter/underscore and must not
repeat within a path. `index` is a literal URL segment, not a special filename.

PowerPoint routes use literal template folders (`brief`, `business`, `summary`, and `daa`). Each
handler selects its existing registered template; template names are not URL
parameters. Add a dedicated route when exposing another template.

## Add an endpoint

Create `src/routes/reports/[id]/get.ts`:

```ts
import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler(
  dependencies: RouteDependencies,
): RequestHandler<Record<string, string>> {
  return (req, res) => {
    // Validate params/query and call an injected service here.
    res.json({ id: req.params.id });
  };
}
```

This exposes `GET /reports/:id` automatically. Factories run once per `createApp`
call and return Express handlers; injected services keep tests independent of
Chromium. Express 5 forwards rejected handler promises to the existing error
middleware. Continue validating inputs and using `sendDownload` for queued files.

For shared GET/POST logic, define the factory in `handler.ts` and re-export it
from both method files:

```ts
export { default } from './handler.ts';
```

Helper files such as `handler.ts` are not endpoints. Directories beginning with
`_` or `.` are excluded from discovery; symlinks are not traversed.

## Document an endpoint

Wrap the default-exported factory with `documentedRoute` and reference its existing validation schema:

```ts
import { documentedRoute } from '@/http/openapi/route';
import { pdfSchema } from '@/schemas';

export default documentedRoute(createHandler, {
  summary: 'Generate a webapp PDF',
  tag: 'PDF',
  input: pdfSchema,
  format: 'pdf',
  example: { route: '/reports/quarterly' },
});
```

`input` describes structured generation input shared by POST bodies and decoded GET/HEAD query parameters. Use `query` for directly validated query objects, `params` for path parameters, and `response` for JSON responses. Downloads use `format: 'pdf'` or `'pptx'`; shared headers and errors are generated automatically. `responses` can describe additional JSON statuses, such as readiness returning 503. `noStore` documents cache-control on JSON responses.

Attach metadata to `handler.ts` when GET and POST re-export the same factory; they share one definition. Paths and methods come from route discovery, including implicit HEAD. A route missing documentation fails startup so new endpoints cannot silently disappear from the specification. Zod descriptions and metadata document custom validation rules that JSON Schema cannot infer. Restart after changing schemas or documentation.

`src/http/openapi/document.ts` generates `/openapi.json` using native Zod conversion; `swagger.ts` serves `/docs/` and local Swagger UI assets. Documentation routes are registered centrally before the API routes and 404 handler.

## Loading and ordering

[discoverRoutes](../http/file-routes/discover.ts) discovers route files once when
the application module loads. `createApp` remains synchronous and registers the
factories before the existing 404/error middleware. Restart after adding/moving
files. In production, rebuild first; the loader discovers compiled `.js` method
files in `dist/routes/` without requiring a TypeScript runtime loader.
`npm run build` clears generated `dist/` output before compiling so removed or
moved routes cannot survive as stale JavaScript files.

Static segments precede parameters, including static children below dynamic
parents. Parameter suffixes precede less specific parameter paths. Explicit HEAD
handlers precede GET handlers, which otherwise provide Express's implicit HEAD.
Duplicate method/path shapes fail startup, including case variants and parameter
name variants such as `[id]` versus `[name]`. Missing default factories and
factories returning non-functions also fail startup.

Route entry points are declared in `knip.json`; the method-file glob automatically
covers new routes. Add HTTP behavior tests under `test/http/` and update
`docs/endpoints.md` when adding an endpoint. Run `npm run typecheck`,
`npm run knip`, and `npm test`.
