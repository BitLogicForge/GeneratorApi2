# Intranet user identity placeholders

[Back to overview](../README.md)

This branch provides scaffolding for identifying corporate users with Entra API
access tokens obtained by the React application's existing MSAL login. It has no
user roles or route permission rules. Once authentication is connected, any
verified user in the configured tenant can call the exports.

## Configuration and integration point

`AUTH_MODE=disabled` is the default and preserves the open local demo.
`AUTH_MODE=entra` requires your actual tenant and API app-registration client IDs:

```dotenv
AUTH_MODE=entra
ENTRA_TENANT_ID=<corporate-tenant-guid>
ENTRA_API_CLIENT_ID=<api-app-registration-client-guid>
ENTRA_API_SCOPE=access_as_user
AZURE_CLIENT_ID=<uami-client-guid>
```

Replace the `verifyAccessToken` placeholder in `src/auth/entra.ts` with a maintained
token verifier using the tenant's OIDC metadata and signing keys. It must verify
signature, issuer, API audience, expiration/not-before, tenant, and a delegated
user token with the configured API scope before returning `{ tenantId, objectId }`
from verified `tid` and `oid` claims. The scope is an integration placeholder,
not a per-route permission policy. ID tokens and app-only tokens are unsuitable
for this user identity contract. See Microsoft's [claim-validation guidance](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

The placeholder accepts no tokens. In Entra mode, missing/invalid bearer headers
return 401 `UNAUTHENTICATED`; a supplied token returns 503 `AUTH_NOT_CONFIGURED`
until the verifier is implemented. Health GET/HEAD remain public. After wiring
the verifier, invalid tokens return 401 and verified users proceed to the route.
No JWT library or live Entra calls are added by this scaffold. Tests inject a
verifier into `createApp({ authentication, ... })`.

## Pass identity to endpoints

Every authenticated handler receives `res.locals.user`. The PDF export handlers
and DAA demo additionally pass an optional `GenerationContext` argument to their
injected services, containing `context.user`. Existing generation implementations
ignore this argument; future services can use it to request user-specific report
data. GET and POST pass the same identity; HEAD authenticates but never generates.

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

The Azure UAMI identifies the **API workload** when it calls Azure services.
`AZURE_CLIENT_ID` is a separate placeholder for selecting that managed identity
when an Azure SDK credential is added. It is not consumed by this scaffold and
does not replace the API audience or identify the requesting user. See
[Microsoft's managed identity guide](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview-for-developers).

Intranet-only access is configured through Azure networking/access restrictions;
sharing a network does not establish a user's identity. A SPA hosted on a
different origin also needs an explicit CORS policy at the API or gateway.
Network setup, CORS, downstream UAMI credentials, and live token verification are
integration work for later; this branch establishes the identity boundary and
service context only.
