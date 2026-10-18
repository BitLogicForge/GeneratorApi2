# Getting Started

[Back to Documentation Index](../README.md)

## Local Setup

```bash
npm ci
npm run browser:install
cp .env.example .env
npm run dev
```

- `npm run browser:install` installs headless Chromium and its Linux system
  dependencies.
- The API listens on `API_HOST:API_PORT` (default `0.0.0.0:3000`).
- For PDF routes that render local demo pages (`/pdf/factsheet/:id`,
  `/pdf/onepager/:id`, `/pdf/quarterly`), run `npm run demo` in a second
  terminal (starts the demo webapp on `http://localhost:3001`).

## Sample Requests

```bash
# Health & readiness
curl http://localhost:3000/health
curl http://localhost:3000/internal/ready

# PDF from local demo webapp (requires `npm run demo`)
curl --fail-with-body http://localhost:3000/pdf/factsheet/id2222 -o factsheet.pdf
curl --fail-with-body 'http://localhost:3000/pdf/quarterly?year=2026&quarter=2&language=en' -o quarterly.pdf

# PowerPoint from JSZip template
curl --fail-with-body 'http://localhost:3000/pptx/daa?TEXT_ME=Quarterly%20Update' -o daa.pptx
curl --fail-with-body 'http://localhost:3000/pptx/tma?TEXT_ME=Summary' -o tma.pptx

# PowerPoint generated via PptxGenJS
curl -X POST http://localhost:3000/pptxgenjs/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/generated.json -o brief.pptx
```

## Docker & Devcontainer Networking

- `API_HOST=0.0.0.0` allows connections from outside the container when port
  `3000` is published (`-p 127.0.0.1:3000:3000`).
- `WEBAPP_BASE_URL` and `DATA_API_BASE_URL` are resolved from inside the
  container. When targeting a server running on the host machine, use
  `http://host.docker.internal:<port>` (with `--add-host=host.docker.internal:host-gateway`
  on Linux Docker Engine).
