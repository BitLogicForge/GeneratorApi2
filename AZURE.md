# Azure App Service deployment

This package targets **Linux App Service with Node.js 22 or newer**. Build from Linux, WSL, or the devcontainer:

```bash
npm ci
npm run build:azure
```

The build creates `output/azure/generator-api.zip`. It compiles into a clean staging directory, installs production dependencies from the lockfile, and packages `dist/`, `node_modules/`, `templates/`, package manifests, and `scripts/start-azure.sh` at the ZIP root. Source code, demos, `.env`, and generated reports are excluded. Your working `node_modules` remains unchanged. ZIP packages must contain the application files at the root, as described in [Azure ZIP deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip).

The language and PDF document route are code settings in `src/config.ts`:

```ts
export const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/documents/{id}',
};
```

Edit these before building; rerun `npm run build:azure` after a change.

## App Service settings

Configure the Web App's Node.js runtime to 22+ and set its startup command to:

```text
bash scripts/start-azure.sh
```

Set these application settings in Azure:

| Setting                          | Value                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`                       | `production`                                                         |
| `HOST`                           | `0.0.0.0`                                                            |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` — package is already built                                   |
| `WEBAPP_BASE_URL`                | Public/internal origin of the webapp to render, reachable from Azure |
| `DATA_API_BASE_URL`              | Optional data API URL, including its prefix                          |
| `DATA_API_TOKEN`                 | Optional bearer token, configured in Azure rather than packaged      |
| `DATA_API_TIMEOUT_MS`            | `10000`                                                              |

Keep Azure's supplied `PORT`; the application reads it automatically. The startup script installs Chromium and its Linux libraries using the packaged Playwright CLI, stores browser files under `/home/playwright`, then launches the compiled server. Browser installation needs outbound download access and system-library installation permissions. If your hosting policy prohibits installing OS packages at startup, use a custom container that installs them during its image build. See [Playwright browser installation](https://playwright.dev/docs/browsers).

The startup command supports SIGTERM forwarding through `exec`, allowing the API's existing graceful shutdown. Configuration and Node startup options are described in [Azure's Node.js guidance](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs?pivots=platform-linux).

## Deploy an existing Web App

After setting the runtime and application settings:

```bash
az webapp config set \
  --resource-group YOUR_RESOURCE_GROUP \
  --name YOUR_WEB_APP \
  --startup-file 'bash scripts/start-azure.sh'

az webapp deploy \
  --resource-group YOUR_RESOURCE_GROUP \
  --name YOUR_WEB_APP \
  --src-path output/azure/generator-api.zip \
  --type zip
```

These commands change Azure resources; the build command only produces a local package.

Verify after deployment:

```bash
curl --fail-with-body https://YOUR_WEB_APP.azurewebsites.net/health
curl --fail-with-body 'https://YOUR_WEB_APP.azurewebsites.net/demo-report.pptx?TEXT_ME=Azure%20demo' --output demo-report.pptx
curl --fail-with-body 'https://YOUR_WEB_APP.azurewebsites.net/id2222.pdf?language=en' --output id2222.pdf
```

The PDF request requires a matching document page on `WEBAPP_BASE_URL`. `/health` verifies process availability; it does not render a document. Browser/library downloads on first startup can lengthen startup time; inspect App Service logs if startup fails.
