import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { z } from 'zod';

import { AppError } from '@/errors';

import type { JWTVerifyGetKey } from 'jose';
import type { AuthConfig } from './config.ts';
import type { AuthenticationOptions } from './types.ts';

const userClaims = z.object({
  ver: z.literal('2.0'),
  tid: z.guid(),
  oid: z.guid(),
  scp: z.string().min(1),
  idtyp: z.string().optional(),
});

/** Validates single-tenant Entra v2 user access tokens using cached, rotating signing keys. */
export function createEntraAuthentication(
  config: AuthConfig,
): AuthenticationOptions | undefined {
  if (config.mode === 'disabled') return undefined;
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  const jwksUrl = new URL(
    `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
  );
  jwksUrl.searchParams.set('appid', config.audience);
  const remoteKeys = createRemoteJWKSet(jwksUrl, { timeoutDuration: 5000 });
  const keys: JWTVerifyGetKey = async (header, token) => {
    try {
      return await remoteKeys(header, token);
    } catch (error) {
      if (error instanceof errors.JWKSNoMatchingKey) throw error;
      throw new AppError(
        503,
        'AUTH_UNAVAILABLE',
        'Identity signing keys are temporarily unavailable',
      );
    }
  };
  return {
    tenantId: config.tenantId,
    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer,
          audience: config.audience,
          algorithms: ['RS256'],
          requiredClaims: ['exp', 'iat', 'nbf', 'tid', 'oid', 'scp', 'ver'],
          clockTolerance: 5,
        });
        const claims = userClaims.parse(payload);
        if (
          claims.tid.toLowerCase() !== config.tenantId ||
          claims.idtyp === 'app' ||
          !claims.scp.split(/\s+/).includes(config.scope)
        )
          throw new Error('Not a delegated user token for this API');
        return {
          tenantId: claims.tid.toLowerCase(),
          objectId: claims.oid.toLowerCase(),
        };
      } catch (error) {
        if (error instanceof AppError && error.status === 503) throw error;
        throw new AppError(
          401,
          'UNAUTHENTICATED',
          'A valid API access token is required',
        );
      }
    },
  };
}
