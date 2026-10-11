import { AppError } from '@/errors';

import type { AuthConfig } from './config.ts';
import type { AuthenticationOptions } from './types.ts';

/** Wiring placeholder: enabling protection never accepts an unverified token. */
export function createEntraAuthentication(
  config: AuthConfig,
): AuthenticationOptions | undefined {
  if (config.mode === 'disabled') return undefined;
  return {
    tenantId: config.tenantId,
    async verifyAccessToken(_token) {
      // TODO: plug in a maintained JWT verifier using this tenant's OIDC metadata/JWKS.
      // Validate signature, issuer, audience=config.audience, exp/nbf and tid.
      // Require a delegated user token with config.scope; return only verified tid/oid.
      // Never substitute JWT decoding, an ID token, or client-supplied identity headers.
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Access-token verification is not configured',
      );
    },
  };
}
