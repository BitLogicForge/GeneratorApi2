import { AppError } from '@/errors';

import type { RequestHandler } from 'express';

/** Returns only the identity derived from the verified API access token. */
export default function createHandler(): RequestHandler {
  return (_req, res) => {
    if (!res.locals.user) {
      res.set('WWW-Authenticate', 'Bearer');
      throw new AppError(
        401,
        'UNAUTHENTICATED',
        'A valid API access token is required',
      );
    }
    res.set('Cache-Control', 'no-store').json({ user: res.locals.user });
  };
}
