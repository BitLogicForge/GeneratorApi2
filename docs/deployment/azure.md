# Azure deployment with ZIP package and GitLab CI

[Back to overview](../../README.md)

This deployment packages the compiled application, presentation templates, and production dependencies into a standalone ZIP package (`output/azure/generator-api.zip`) for Linux Azure App Service. GitLab compiles the application, packages the ZIP, and deploys it using the Azure CLI (`az webapp deploy`).

## Packaging workflow

GitLab CI handles package creation in the `build` job: it compiles the application, installs production dependencies (`npm ci --omit=dev`), extracts CA certificates from the build container into `certs/`, and archives `dist/`, `package.json`, `package-lock.json`, `templates/`, `scripts/start-azure.sh`, `certs/`, and `node_modules/` into `output/azure/generator-api.zip`.

To package manually on Linux or in the devcontainer:

```bash
npm run build
npm ci --omit=dev
bash scripts/collect-certs.sh certs
mkdir -p output/azure
zip -q -r output/azure/generator-api.zip dist package.json package-lock.json scripts/start-azure.sh templates node_modules certs
```

## Runtime configuration and startup

The package starts through [scripts/start-azure.sh](../../scripts/start-azure.sh). It configures the container CA certificates into `NODE_EXTRA_CA_CERTS` and `SSL_CERT_FILE` (and updates the system CA store if permissions permit) before installing Chromium and its Linux libraries into `/home/playwright` on first run, and finally starts `node dist/index.js`.

Configure the App Service with the following settings:

| Setting                               | Value                        | Purpose                                                   |
| ------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| `NODE_ENV`                            | `production`                 | Production mode                                           |
| `API_HOST`                            | `0.0.0.0`                    | Listen on all interfaces                                  |
| `API_PORT`                            | `3000`                       | Port routed by App Service                                |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `true`                       | Preserves `/home/playwright` browser cache across reboots |
| `PLAYWRIGHT_BROWSERS_PATH`            | `/home/playwright`           | Browser storage location                                  |
| `WEBSITE_WARMUP_PATH`                 | `/internal/ready`            | Warmup probe path                                         |
| `WEBSITE_WARMUP_STATUSES`             | `200`                        | Warmup probe success status                               |
| `WEBAPP_BASE_URL`                     | `https://YOUR_WEBAPP_ORIGIN` | Origin for webapp PDF page rendering                      |
| `PDF_ALLOW_HTTP_404`                  | `true`                       | Accept HTTP 404 from Azure Blob Storage React SPA routing |
| `LOG_IGNORE_UNMATCHED`                | `true`                       | Suppress logs for Always On pings and bot scanner probes  |
| `PDF_LOG_REQUESTS`                    | `true`                       | Verbose logging: log webapp target URL and status for PDF |

The App Service startup command must be set to:

```bash
bash scripts/start-azure.sh
```

## Azure App Service log noise and bot scanners

Public Azure App Services (`*.azurewebsites.net`) routinely receive high volumes of requests that generate `route: "unmatched"` (404) log entries:

1. **App Service Always On**: Azure's Always On mechanism periodically sends HTTP pings (typically `GET /` or `HEAD /`) to keep the container awake. Because Generator API only registers `/health`, `/internal/*`, and export routes, root pings return 404.
2. **Automated internet scanners**: Botnets and vulnerability scanners constantly probe public Azure domains for common exploit paths (e.g. `/.env`, `/wp-login.php`, `/favicon.ico`, `/robots.txt`).
3. **Health and load balancer probes**: Default health probes that check `/` rather than `/internal/ready` or `/health`.

To prevent these unmatched requests from flooding your App Service log stream, set:

```bash
LOG_IGNORE_UNMATCHED=true
```

Unmatched requests will still be tracked in internal performance metrics (`/internal/metrics`), but will not be logged to stdout. If you also wish to silence specific probe routes from logs, configure:

```bash
LOG_EXCLUDE_ROUTES=/health,/internal/ready
```

## Azure Blob Storage static website hosting for React SPAs

When hosting a React SPA on Azure Blob Storage static website hosting (`$web`):

1. Deep client-side routes (e.g. `/reports/quarterly`) do not exist as physical files on blob storage.
2. A standard SPA technique on Azure Blob Storage is setting the **Error document path** to `index.html`.
3. When requesting a client route, Azure Blob Storage serves `index.html` but sends an **HTTP 404 Not Found** status code. The browser executes the React bundle and React Router renders the view.
4. By default, Generator API enforces strict 2xx responses (`response.ok()`), rejecting 404 responses with `502 UpstreamError`.
5. Setting `PDF_ALLOW_HTTP_404=true` allows the PDF renderer to accept 404 status codes, wait for your readiness selector (`waitForSelector`), and render the React SPA cleanly. This can also be set per report using `allowHttp404: true` in `definePdfReport`.

Every PDF render logs the exact upstream URL requested and its response status:

```json
{"event":"pdf_page_requested","url":"https://mystorage.z6.web.core.windows.net/reports/quarterly?company=Acme"}
{"event":"pdf_page_loaded","url":"https://mystorage.z6.web.core.windows.net/reports/quarterly?company=Acme","status":404,"durationMs":142}
```

## Azure setup and deployment

Authenticate with the Azure CLI and deploy the package:

```bash
AZURE_RESOURCE_GROUP='YOUR_RESOURCE_GROUP'
AZURE_WEBAPP_NAME='YOUR_WEBAPP_NAME'

# Deploy the ZIP package
az webapp deploy \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_WEBAPP_NAME" \
  --src-path output/azure/generator-api.zip \
  --type zip \
  --async false

# Configure startup script
az webapp config set \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_WEBAPP_NAME" \
  --startup-file 'bash scripts/start-azure.sh'

# Restart the app
az webapp restart \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_WEBAPP_NAME"
```

For slot deployments (e.g. `dev`), add `--slot dev` to the commands.

## GitLab CI pipeline

The pipeline defined in [.gitlab-ci.yml](../../.gitlab-ci.yml) automates this workflow:

1. **`test` stage (`lint` & `test`):** Runs static checks (`lint`) and unit tests (`test`) concurrently in parallel with runner caching.
2. **`build` stage (`build`):** Compiles with `npm run build`, prunes dev-dependencies (`npm prune --omit=dev`), and packages `output/azure/generator-api.zip`.
3. **`deploy` stage (`deploy_main` / `deploy_dev`):** Deploys the ZIP package directly to Azure Web App production or the dev slot using `az webapp deploy`.

Configure the following secrets in GitLab **Settings > CI/CD > Variables**:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
