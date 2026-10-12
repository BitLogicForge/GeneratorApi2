# Azure deployment with Docker, ACR, and GitLab CI

[Back to overview](../README.md)

Use your prebuilt image containing Node.js and Chromium as the base for [Dockerfile](../Dockerfile). GitLab compiles the application, then ACR builds and pushes the deployment image from the supplied context. Azure Web App pulls that image using managed identity and starts the compiled API directly.

## Prebuilt image and build context

Replace `your-registry.example.com/node-chromium:replace-me` in `RUNTIME_IMAGE` at the top of [.gitlab-ci.yml](../.gitlab-ci.yml), or set it as a GitLab CI/CD variable. The same placeholder is the Dockerfile's default. Set `RUNTIME_USER` to an existing non-root user in your image; its default is `node`.

The base image must provide:

- Node.js 22+, npm, and a shell.
- Playwright-compatible Chromium and its Linux system libraries.
- A browser cache readable/executable by the runtime user, with `PLAYWRIGHT_BROWSERS_PATH` set in the base image if needed.
- The runtime user specified by `RUNTIME_USER`.

The application's `chromium.launch()` uses Playwright's browser cache. A system Chromium executable alone is insufficient with the current configuration. Match the base image's browser installation to the Playwright version in `package-lock.json` (currently 1.64.0). The Dockerfile preserves the base image's browser-path environment and skips browser downloads when installing npm packages. See [Playwright image compatibility](https://playwright.dev/docs/docker#image-tags).

GitLab runs `npm run build` and passes `dist/` to the ACR job as an artifact. The Dockerfile copies that compiled output, production dependencies, presentation templates, and the npm/smoke helper scripts. It does not copy `src/`. ACR supplies the context; Docker's `COPY` instructions select the files included in the image. The [.dockerignore](../.dockerignore) allows only those deployment inputs, excluding source, secrets, Git metadata, local dependencies, and generated reports from the uploaded context.

The image build runs `npm run smoke:container` as the runtime user. This starts the compiled API with a local webapp fixture, waits for browser/template readiness, checks health, and verifies a filled PowerPoint and a real PDF download. A failed check stops the build. Chromium and OS packages are supplied by your base image.

## Build and run locally

Build the compiled application before invoking Docker:

```bash
npm ci
npm run build

docker build --platform linux/amd64 \
  --build-arg RUNTIME_IMAGE=YOUR_PREBUILT_CHROMIUM_IMAGE \
  --build-arg RUNTIME_USER=node \
  --tag generator-api:local .

docker run --rm --init \
  --publish 127.0.0.1:3000:3000 \
  --env WEBAPP_BASE_URL=https://YOUR_WEBAPP_ORIGIN \
  generator-api:local
```

The base image must be accessible to your local Docker client, the GitLab runner, and ACR's build agent. A private base in the same ACR can use that registry's build authentication. For a private image used as the GitLab verification job image, configure the runner's registry authentication, for example through `DOCKER_AUTH_CONFIG`.

`WEBAPP_BASE_URL` must be reachable from inside the container; see [Docker networking](getting-started.md#access-from-outside-docker). Runtime configuration comes from environment variables. The image starts `node dist/index.js` directly, preserving the API's SIGTERM shutdown behavior.

## One-time Azure setup

This example targets an existing **Linux Web App with classic single-container configuration** and an existing ACR. Sidecar-enabled Web Apps require different image/port configuration; this pipeline uses `az webapp config container set` and `WEBSITES_PORT`. See [Azure custom container configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?pivots=container-linux).

Create a `dev` deployment slot before running development deployments. Your App Service plan must support slots. For an existing Node.js Web App, the pipeline switches its runtime to the custom image and clears the old `bash scripts/start-azure.sh` startup command.

Authenticate as an Azure administrator, replace these values, and grant production managed identity access to ACR:

```bash
AZURE_RESOURCE_GROUP='YOUR_WEBAPP_RESOURCE_GROUP'
AZURE_WEBAPP_NAME='YOUR_WEBAPP_NAME'
AZURE_ACR_RESOURCE_GROUP='YOUR_ACR_RESOURCE_GROUP'
AZURE_ACR_NAME='YOUR_ACR_NAME'

az login
az account set --subscription YOUR_SUBSCRIPTION_ID
ACR_ID=$(az acr show \
  --resource-group "$AZURE_ACR_RESOURCE_GROUP" \
  --name "$AZURE_ACR_NAME" --query id --output tsv)
WEBAPP_IDENTITY=$(az webapp identity assign \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_WEBAPP_NAME" --query principalId --output tsv)

az role assignment create \
  --assignee-object-id "$WEBAPP_IDENTITY" \
  --assignee-principal-type ServicePrincipal \
  --scope "$ACR_ID" --role AcrPull
```

The slot has its own identity; grant it access separately:

```bash
DEV_IDENTITY=$(az webapp identity assign \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_WEBAPP_NAME" --slot dev \
  --query principalId --output tsv)

az role assignment create \
  --assignee-object-id "$DEV_IDENTITY" \
  --assignee-principal-type ServicePrincipal \
  --scope "$ACR_ID" --role AcrPull
```

The pipeline configures `acrUseManagedIdentityCreds=true` on each target. Role assignments can take time to propagate. Managed identity pulls require ACR to accept ARM audience tokens; check with `az acr config authentication-as-arm show --registry "$AZURE_ACR_NAME"` and enable if needed with `az acr config authentication-as-arm update --registry "$AZURE_ACR_NAME" --status enabled`. See [Azure managed identity pull instructions](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?pivots=container-linux#use-managed-identity-to-pull-an-image-from-azure-container-registry).

These role assignments assume ACR's **RBAC Registry Permissions** mode. For **RBAC Registry + ABAC Repository Permissions**, use `Container Registry Repository Reader` instead of `AcrPull` for both Web App identities.

## GitLab variables and permissions

Edit the placeholders in `.gitlab-ci.yml`, or override them through GitLab CI/CD variables:

| Variable                           | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `RUNTIME_IMAGE`                    | Your prebuilt Node.js/Chromium image               |
| `RUNTIME_USER`                     | Existing non-root runtime user, default `node`     |
| `AZURE_SUBSCRIPTION_ID`            | Subscription containing the resources              |
| `AZURE_RESOURCE_GROUP`             | Web App resource group                             |
| `AZURE_WEBAPP_NAME`                | Web App name                                       |
| `AZURE_DEV_SLOT`                   | Existing slot, default `dev`                       |
| `AZURE_ACR_NAME`                   | ACR resource name, without its domain              |
| `AZURE_ACR_RESOURCE_GROUP`         | ACR resource group                                 |
| `ACR_REPOSITORY`                   | Image repository, default `generator-api`          |
| `PRODUCTION_BRANCH` / `DEV_BRANCH` | Deployment branches, defaults `main` / `dev`       |
| `AZURE_CLI_IMAGE`                  | Azure CLI job image; pin a version for your runner |

Add these credentials under **GitLab → Settings → CI/CD → Variables**:

| Variable              | Value                                            |
| --------------------- | ------------------------------------------------ |
| `AZURE_CLIENT_ID`     | Service principal application/client ID          |
| `AZURE_CLIENT_SECRET` | Service principal secret; mark masked and hidden |
| `AZURE_TENANT_ID`     | Azure tenant ID                                  |

Grant the service principal `Website Contributor` scoped to the Web App, covering its slots. At the ACR scope, grant `Reader` for registry discovery, `Container Registry Tasks Contributor` for remote builds, and `AcrPush` for image access. An administrator assigns roles once; the pipeline does not create identities or assign roles.

For an ABAC-enabled registry, replace `AcrPush` with `Container Registry Repository Writer` and `Container Registry Repository Catalog Lister`, and add `--source-acr-auth-id '[caller]'` to the `az acr build` command. See [ACR Tasks and image permissions](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-built-in-roles-directory-reference#container-registry-tasks-contributor).

Protect both deployment branches if credentials are protected variables. Use environment scope `*` for shared Azure credentials so the build job, which has no deployment environment, can also access them. Runtime credentials such as `DATA_API_TOKEN` belong in Azure App Service settings.

## Pipeline behavior

| Pipeline/branch | Behavior                                                  |
| --------------- | --------------------------------------------------------- |
| Merge request   | Lint, types, Knip, formatting, tests, compilation         |
| `main`          | Verify, compile, ACR build/push, production deployment    |
| `dev`           | Verify, compile, ACR build/push, deployment to `dev` slot |

Other branch pipelines are skipped. Verification uses your prebuilt image and runs no browser installer. ACR builds remotely with `az acr build`; the GitLab runner needs no Docker daemon or privileged Docker mode. Use a Linux runner with a Docker/Kubernetes executor that can pull the configured job images.

The image is tagged with `$CI_COMMIT_SHA-$CI_PIPELINE_ID`. Its full name is passed to deployment through a dotenv artifact, so each deployment selects the image built by that pipeline. Deployments are serialized separately for production and development. ACR Tasks must be available for the subscription and able to reach the base image and npm registry. See [Azure CLI ACR builds](https://learn.microsoft.com/en-us/cli/azure/acr#az-acr-build).

## App Service settings and verification

Set `WEBAPP_BASE_URL` to the webapp origin reachable from Azure. Configure optional `DATA_API_BASE_URL`, `DATA_API_TOKEN`, and `DATA_API_TIMEOUT_MS` in Azure. Set environment-specific values separately on production and the slot, mark them as deployment slot settings, and disable automatic swapping if `dev` should remain separate.

Remove an old `PLAYWRIGHT_BROWSERS_PATH=/home/playwright` App Service setting if it overrides your base image's browser path. The pipeline disables App Service storage, so the base image's browser files stay visible even when installed under `/home`.

Each deployment sets `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `WEBSITES_PORT=3000`, and `WEBSITES_ENABLE_APP_SERVICE_STORAGE=false`. `PORT` controls the API; `WEBSITES_PORT` tells classic App Service which container port to route to. It sets `WEBSITE_WARMUP_PATH=/internal/ready` and `WEBSITE_WARMUP_STATUSES=200` to wait for Chromium and templates before accepting traffic. Configure `/internal/ready` as Azure's Health check path if desired; Docker's `HEALTHCHECK` is for Docker runtimes.

Verify the deployed application:

```bash
curl --fail-with-body https://YOUR_WEB_APP.azurewebsites.net/internal/ready
curl --fail-with-body https://YOUR_WEB_APP.azurewebsites.net/health
curl --fail-with-body 'https://YOUR_WEB_APP.azurewebsites.net/api/exports/pptx/jszip/daa?TEXT_ME=Azure%20demo' --output demo-report.pptx
curl --fail-with-body 'https://YOUR_WEB_APP.azurewebsites.net/api/exports/pdf/factsheet/id2222?language=en' --output id2222.pdf
```

Use the slot's hostname for development checks. The PDF request requires a matching document page on `WEBAPP_BASE_URL`. For startup problems, enable container logging with `az webapp log config --resource-group YOUR_RESOURCE_GROUP --name YOUR_WEB_APP --docker-container-logging filesystem`, then inspect `az webapp log tail`.

Roll back by setting `--container-image-name` to a previous successful tag using `az webapp config container set`, then run `az webapp restart`. Include `--slot dev` for slot operations. Private ACRs require suitable VNet integration and image-pull routing; see [network-protected registry configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?pivots=container-linux#use-an-image-from-a-network-protected-registry).

The document language and external route live in each PDF route folder's `report.ts`; shared PDF appearance lives in `src/config/defaults.ts`, and other report settings live in their `report.ts`. Recompile and rebuild after changing code or presentation templates.

## Legacy ZIP packaging

`npm run build:azure` and `npm run test:azure` remain available for Node.js App Service hosts that permit Chromium and OS package installation at startup. They create and verify `output/azure/generator-api.zip`, using `bash scripts/start-azure.sh` as the startup command. The GitLab pipeline described here uses the prebuilt Chromium base image and container deployment.
