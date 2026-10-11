# Intranet user identity (Entra/MSAL)

[Back to overview](../README.md)

The API identifies corporate users from Entra access tokens obtained by the
React application's existing MSAL login. Any verified user in the configured
tenant with the delegated API scope can call exports. There are no user-role
checks. Identity is kept separate from the API workload's Azure UAMI.

## Fill the environment variables

`AUTH_MODE=disabled` is the default and preserves the open local demo.
`AUTH_MODE=entra` requires your actual tenant and API app-registration client IDs:

```dotenv
AUTH_MODE=entra
ENTRA_TENANT_ID=<corporate-tenant-guid>
ENTRA_API_CLIENT_ID=<api-app-registration-client-guid>
ENTRA_API_SCOPE=access_as_user
CORS_ALLOWED_ORIGINS=https://intranet.example.com
AZURE_CLIENT_ID=<uami-client-guid>
```

`ENTRA_API_CLIENT_ID` is the API app registration's application/client ID, not
the React client ID or UAMI ID. `ENTRA_API_SCOPE` is the short scope name that
appears in `scp`, without the `api://.../` prefix. CORS accepts a comma-separated
list of exact HTTP(S) SPA origins with no paths or wildcards; leave it empty for
same-origin access. `AZURE_CLIENT_ID` is optional and selects the UAMI assigned
to the Azure host. No client secret is needed for token validation or UAMI.

Before deploying, configure Entra once:

1. Register the API in your corporate tenant. Set `api.requestedAccessTokenVersion`
   to `2` in its manifest; this API accepts v2 access tokens.
2. Expose the delegated `access_as_user` scope (or your configured name) under
   the API's Application ID URI.
3. Give the existing React app registration that delegated API permission and
   complete your organization's consent process. Request this API scope through
   the existing MSAL login.
4. Assign the UAMI to the Azure host if the API will use it for downstream
   resources, and grant it access to those resources.

After those Azure settings exist, fill the variables and start/deploy the API.
No verifier code needs replacing. See Microsoft's [API registration guidance](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-app-registration).

`GET /api/me` returns the verified `{ "user": { "tenantId", "objectId" } }`.
It requires Entra authentication even when the local document demo is open.

`src/auth/entra.ts` uses `jose` to validate RS256 signatures against the tenant's
signing keys, exact issuer/API audience, expiration/not-before, token version,
tenant, user object ID, and delegated scope. Keys are fetched lazily over HTTPS,
cached, and refreshed for key rotation. The Azure host needs outbound access to
`login.microsoftonline.com`. ID tokens, app-only tokens, tokens for another API,
and tokens from another tenant are rejected. See [claim validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation)
and [jose's remote key resolver](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md).

Missing/invalid tokens return 401 `UNAUTHENTICATED`. A signing-key retrieval
failure returns 503 `AUTH_UNAVAILABLE`; health GET/HEAD remain public. HTTP
handlers still support an injected verifier through `createApp`.

## Pass identity to endpoints

Every authenticated handler receives `res.locals.user`. The PDF export handlers
and DAA demo additionally pass an optional `GenerationContext` argument to their
injected services, containing `context.user`. Existing generation implementations
ignore this argument; future services can use it to request user-specific report
data. GET and POST pass the same identity; HEAD authenticates but never generates.

When `AZURE_CLIENT_ID` is set, `@azure/identity` creates a
`ManagedIdentityCredential`. It is available as `azureCredential` in injected
route dependencies and `context.azureCredential` in PDF/DAA services. Pass it to
an Azure SDK client or call `await context.azureCredential.getToken(resourceScope)`
for a downstream resource's `/.default` scope. Token acquisition occurs on use;
no resource is contacted at startup. The current document demos do not call
downstream Azure resources.

Use the combined `tenantId` and `objectId` as the stable user key. Do not derive
identity from request parameters, email, decoded tokens, or client-supplied
`X-MS-CLIENT-PRINCIPAL` headers. Each request keeps its own identity. Bearer tokens
are not copied into query strings, document data, the generation context, or
Chromium. Identifying the export caller does not sign Chromium into the webapp.

## React MSAL and Azure UAMI

In React, request the exposed API scope (`api://<api-app-client-id>/access_as_user`)
through the existing MSAL instance, then send `result.accessToken` as
`Authorization: Bearer ...` on the API request. Use an authenticated fetch followed
by a blob download; ordinary download links cannot attach a bearer header. See
[Microsoft's SPA token acquisition guide](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token).

For example, using your existing signed-in MSAL instance and account:

```js
const result = await msalInstance.acquireTokenSilent({
  account,
  scopes: ['api://<api-app-client-id>/access_as_user'],
});
const response = await fetch('<generator-api-url>/api/me', {
  headers: { Authorization: `Bearer ${result.accessToken}` },
});
if (!response.ok)
  throw new Error(`Identity request failed: ${response.status}`);
const { user } = await response.json();
```

Use your frontend's existing interactive MSAL flow when silent acquisition
requires interaction. The scope prefix must match the API's Application ID URI
if your organization uses a custom URI instead of `api://<api-app-client-id>`.

The Azure UAMI identifies the **API workload** when it calls Azure services.
`AZURE_CLIENT_ID` selects that managed identity for the injected credential.
It does not replace the API audience or identify the requesting user. See
[Microsoft's managed identity guide](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview-for-developers).

Intranet-only access is configured through Azure networking/access restrictions;
sharing a network does not establish a user's identity. `CORS_ALLOWED_ORIGINS`
allows the configured SPA origins to send Authorization/Content-Type headers,
handles OPTIONS preflights without a bearer token, and exposes download filenames
and request IDs. Configure CORS in one place if your Azure gateway also handles it.

Runtime tests and live Azure/MSAL authentication were not run for this
implementation, as requested. Static checks and compilation do not verify your
tenant, consent, network, or managed-identity assignments.
