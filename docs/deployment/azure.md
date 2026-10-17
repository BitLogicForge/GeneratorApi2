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

The App Service startup command must be set to:

```bash
bash scripts/start-azure.sh
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
