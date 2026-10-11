# PDF generation

[Back to overview](../README.md)

## PDF download URLs

Query parameters are optional. `/id2222.pdf` uses `documentSettings.defaultLanguage` (`en` by default), configured in `src/config.ts`; `/id2222.pdf?language=de` overrides it. A language already set in `documentSettings.pdfRoutePattern` stays authoritative. Other omitted query parameters use your webapp's defaults.

`GET /:id.pdf` provides a direct download link such as `https://generator-host/id2222.pdf`. Configure the webapp host in Azure application settings (or `.env` locally) and the document route in `src/config.ts`:

```dotenv
WEBAPP_BASE_URL=https://other-host.example
```

In `src/config.ts`:

```ts
export const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/document?id={id}',
};
```

With these settings, `https://generator-host/id2222.pdf?language=en` renders `https://other-host.example/document?id=id2222&language=en` and returns an `id2222.pdf` attachment. For path-based webapps, use `pdfRoutePattern: '/documents/{id}'` in `src/config.ts` (the default). Additional query parameters are forwarded as strings. Query keys already configured in the pattern cannot be overridden by the caller. Duplicate query keys are rejected. IDs accept up to 80 letters, numbers, underscores, and hyphens.

The GET endpoint uses the same PDF queue and rendering settings as `POST /api/exports/pdf`. It does not cache documents or forward client cookies. The POST endpoint remains available for per-request readiness selectors and print options. For the included demo, start both servers and open `http://localhost:3000/id2222.pdf`.
