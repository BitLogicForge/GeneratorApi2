import { AppError } from '@/errors';

import type { RequestHandler } from 'express';
import type { FileRoute } from '@/http/file-routes/types';
import type { AuthenticationOptions } from './types.ts';

/** Identifies the user before handlers and queue admission; health remains public. */
export function routeAuthentication(
  route: Pick<FileRoute, 'method' | 'path'>,
  authentication?: AuthenticationOptions,
): RequestHandler<Record<string, string>> {
  const publicRoute =
    route.path === '/health' && ['get', 'head'].includes(route.method);
  return async (req, res, next) => {
    if (!authentication || publicRoute) return next();
    res.set('Cache-Control', 'no-store');
    const unauthenticated = () => {
      res.set('WWW-Authenticate', 'Bearer');
      return new AppError(
        401,
        'UNAUTHENTICATED',
        'A valid API access token is required',
      );
    };
    const header = req.headers.authorization;
    const token =
      typeof header === 'string'
        ? /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(header)?.[1]
        : undefined;
    if (!token) throw unauthenticated();
    const user = await authentication
      .verifyAccessToken(token)
      .catch((error: unknown) => {
        if (error instanceof AppError && error.status === 503) throw error;
        throw unauthenticated();
      });
    if (!user || user.tenantId !== authentication.tenantId || !user.objectId)
      throw unauthenticated();
    res.locals.user = { tenantId: user.tenantId, objectId: user.objectId };
    next();
  };
}
