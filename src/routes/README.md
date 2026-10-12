# File-based routes

PowerPoint API routes are grouped by engine: `api/exports/pptx/jszip/`
contains existing-file templates (`business`, `summary`, and `daa`), and
`api/exports/pptx/pptxgenjs/` contains code-generated designs (`brief`).

Document/report PDF routes live in `api/exports/pdf/`: `portrait/[id].pdf`
and `landscape/[id].pdf` resolve a document ID and force the named orientation;
`portrait/quarterly` prints the configured quarterly webapp page.
The generic GET/POST test export lives in `api/exports/pdf/test/`. It uses the common
PDF renderer schema from `api/exports/pdf/schema.ts`.
PDF reports use `definePdfReport` from `src/reports/pdf.ts`. A local `report.ts`
keeps request validation, target resolution, filenames, and print settings together.
The document-ID routes share `src/reports/document/report.ts` and select orientation
in their method files. Chromium rendering and contracts live in `src/services/pdf/`.

PowerPoint reports use `definePptxReport` with a locally declared `createService`
factory. `templateReport` handles standard placeholder templates. The runtime
constructs and validates these generators once and closes owned services after
HTTP requests drain. Adding a service requires no startup or dependency-type edits.

See [the complete endpoint checklist](../../docs/development.md) for PDF, template
PPTX, custom service, and testing examples.

Folders define the URL. Lowercase method files define the HTTP method:

| File                                        | Endpoint                                  |
| ------------------------------------------- | ----------------------------------------- |
| `health/get.ts`                             | `GET /health`                             |
| `api/exports/pdf/test/post.ts`              | `POST /api/exports/pdf/test`              |
| `api/exports/pptx/pptxgenjs/brief/get.ts`   | `GET /api/exports/pptx/pptxgenjs/brief`   |
| `api/exports/pptx/jszip/business/post.ts`   | `POST /api/exports/pptx/jszip/business`   |
| `api/exports/pdf/portrait/[id].pdf/get.ts`  | `GET /api/exports/pdf/portrait/:id.pdf`   |
| `api/exports/pdf/portrait/quarterly/get.ts` | `GET /api/exports/pdf/portrait/quarterly` |
| `api/exports/pdf/landscape/[id].pdf/get.ts` | `GET /api/exports/pdf/landscape/:id.pdf`  |
| `api/exports/pptx/jszip/daa/get.ts`         | `GET /api/exports/pptx/jszip/daa`         |
| `get.ts`                                    | `GET /` (if added)                        |

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

For shared GET/POST reports, define the factory in `report.ts` and re-export it
from both method files:

```ts
export { default } from './report.ts';
```

Helper files such as `handler.ts` are not endpoints. Directories beginning with
`_` or `.` are excluded from discovery; symlinks are not traversed.

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

For GET/POST exports, declare the request schema in the report definition or a local schema file. The report helpers decode GET/HEAD fields named by `jsonFields` and read POST JSON directly. Supply `readRequestInput` when path parameters or a custom request shape are needed. PDF test decodes `query` and `landscape`, brief decodes `slides`, and placeholder templates decode `replacements`. Keep each endpoint's accepted fields local.
