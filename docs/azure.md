# Azure App Service deployment

[Back to overview](../README.md)

This package targets **Linux App Service with Node.js 22 or newer**. Build from Linux, WSL, or the devcontainer:

```bash
npm ci
npm run build:azure
npm run test:azure
```

The build creates `output/azure/generator-api.zip`. It type-checks the project, compiles into a clean staging directory, installs production dependencies from the lockfile, and packages `dist/`, `node_modules/`, `templates/`, package manifests, and `scripts/start-azure.sh` at the ZIP root. Source code, tests, demos, `.env`, and generated reports are excluded. Your working `node_modules` remains unchanged. ZIP packages must contain the application files at the root, as described in [Azure ZIP deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip).

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
curl --fail-with-body 'https://YOUR_WEB_APP.azurewebsites.net/api/exports/pptx/jszip/daa?TEXT_ME=Azure%20demo' --output demo-report.pptx
curl --fail-with-body 'https://YOUR_WEB_APP.azurewebsites.net/api/exports/pdf/portrait/id2222.pdf?language=en' --output id2222.pdf
```

The PDF request requires a matching document page on `WEBAPP_BASE_URL`. `/health` verifies process availability; it does not render a document. Browser/library downloads on first startup can lengthen startup time; inspect App Service logs if startup fails.

## GitLab runner example

The root `.gitlab-ci.yml` builds the ZIP and deploys automatically:

| Branch | Azure target                 |
| ------ | ---------------------------- |
| `main` | Production webapp            |
| `dev`  | The same webapp's `dev` slot |

Merge request pipelines run verification without packaging or deployment. Branch pipelines for the configured production and development branches verify, package, smoke-test, and deploy; other branch pipelines are skipped. `npm run verify:ci` runs code lint, type checking, Knip, formatting, Chromium installation, and all tests, stopping on the first failure. Packaging requires successful verification, and `npm run test:azure` checks the exact ZIP before it is published as a deployment artifact. Deployment jobs download that ZIP. Deployments to each target are serialized with GitLab resource groups.

Browser downloads are cached under `.cache/ms-playwright/` with a key derived from `package-lock.json`. System dependencies are installed in each Node job even when the browser download is cached. Run `npm run verify:ci` locally on Linux to exercise the same verification commands; browser installation may need system-package permissions.

Use a Linux GitLab runner with a Docker or Kubernetes executor that supports the configured container images. If your runner requires a tag, add its tag under `default: tags:` in `.gitlab-ci.yml`.

Edit the `variables` block at the top of `.gitlab-ci.yml` for the subscription, resource group, webapp name, dev slot, branch names, and container images. `AZURE_ZIP_PATH` must match the build script output. GitLab CI/CD variables can override these defaults.

Add credentials under **GitLab → Settings → CI/CD → Variables**:

| Variable              | Value                                            |
| --------------------- | ------------------------------------------------ |
| `AZURE_CLIENT_ID`     | Azure service principal application/client ID    |
| `AZURE_CLIENT_SECRET` | Service principal secret; mark masked and hidden |
| `AZURE_TENANT_ID`     | Azure tenant ID                                  |

Give the service principal deployment permissions for the webapp and its slots (for example, the Website Contributor role scoped to the webapp). If credentials are protected variables, protect both `main` and `dev` so both branches can access them. Variable environment scopes must cover `production` and `dev`.

Create the `dev` slot in Azure before running the pipeline. Configure the Node.js runtime, `bash scripts/start-azure.sh` startup command, and `SCM_DO_BUILD_DURING_DEPLOYMENT=false` on both production and the slot. Set application variables such as `WEBAPP_BASE_URL` and `DATA_API_TOKEN` separately for each target in Azure; no `.env` file is packaged. Mark environment-specific values as deployment slot settings. Disable automatic slot swapping if `dev` should remain separate from production.

See [GitLab branch rules](https://docs.gitlab.com/ci/jobs/job_rules/) and [Azure CLI ZIP deployment](https://learn.microsoft.com/en-us/cli/azure/webapp#az-webapp-deploy).

The package includes `scripts/install-hooks.mjs` for the npm `prepare` lifecycle. It skips Husky installation when production dependencies are installed, so Azure does not require Git hooks or development dependencies.
