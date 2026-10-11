# Getting started

[Back to overview](../README.md)

## Run

```bash
npm ci
npm run browser:install
cp .env.example .env
npm run dev
```

`npm run browser:install` installs Chromium and its required system libraries. On Linux, installing system packages may require sudo access.

Set `WEBAPP_BASE_URL` to your webapp's origin. The API defaults to port 3000 and the webapp to port 3001. For a complete local demo, run `npm run demo` in another terminal.

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/exports/pdf \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pdf/request.json --output report.pdf
curl -X POST http://localhost:3000/api/exports/pptx/pptxgenjs/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/generated.json --output presentation.pptx
```

## Access from outside Docker

Set the API listening address in `.env`:

```dotenv
HOST=0.0.0.0
PORT=3000
```

`HOST` defaults to `0.0.0.0` so the API accepts connections through the container's network interface. The devcontainer publishes container port 3000 to `127.0.0.1:3000` on your computer. Rebuild the devcontainer after changing its port configuration, then start the API with `npm run dev` and test from a terminal outside Docker:

```bash
curl http://localhost:3000/health
```

For a container started manually, use `docker run -p 127.0.0.1:3000:3000 ...`. If you change `PORT`, change the Docker port mapping to match. To connect from another computer, publish to the host's network interface (for example `-p 3000:3000`) and use `http://<docker-host-ip>:3000`.

`WEBAPP_BASE_URL` is the address Chromium uses from inside the container. If your webapp runs on your computer rather than in the container, configure an address reachable from Docker, such as `http://host.docker.internal:3001` on Docker Desktop. On Linux Docker Engine, add `--add-host=host.docker.internal:host-gateway`; the webapp must listen on an interface reachable from Docker.
