import { HttpHeader } from './constants.ts';

import type { RequestHandler } from 'express';

const ALLOWED_METHODS = 'GET, HEAD, POST';
const ALLOWED_HEADERS = 'Content-Type';
// Lets browser clients read the download filename and correlate errors with server logs.
const EXPOSED_HEADERS = [HttpHeader.ContentDisposition, HttpHeader.RequestId].join(', ');
const PREFLIGHT_MAX_AGE_SECONDS = '600';

/**
 * Allows browser calls from configured origins only. Other origins get no CORS headers, so the
 * browser blocks them; non-browser clients are unaffected.
 */
export function createCors(allowedOrigins: readonly string[]): RequestHandler {
  const origins = new Set(allowedOrigins);
  return (req, res, next) => {
    res.vary(HttpHeader.Origin);
    const origin = req.get(HttpHeader.Origin);
    if (origin === undefined || !origins.has(origin)) return next();
    res.set(HttpHeader.AccessControlAllowOrigin, origin);
    res.set(HttpHeader.AccessControlExposeHeaders, EXPOSED_HEADERS);
    if (req.method !== 'OPTIONS' || !req.get(HttpHeader.AccessControlRequestMethod)) return next();
    res
      .set(HttpHeader.AccessControlAllowMethods, ALLOWED_METHODS)
      .set(HttpHeader.AccessControlAllowHeaders, ALLOWED_HEADERS)
      .set(HttpHeader.AccessControlMaxAge, PREFLIGHT_MAX_AGE_SECONDS)
      .status(204)
      .end();
  };
}
