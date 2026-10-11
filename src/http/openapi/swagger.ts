import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import type { Express } from 'express';
import type { createOpenApiDocument } from './document.ts';

/** Serves local assets and avoids changing CSP on API responses. */
export function registerSwagger(
  app: Express,
  document: ReturnType<typeof createOpenApiDocument>,
) {
  const options = {
    swaggerOptions: { url: '/openapi.json', validatorUrl: null },
    customSiteTitle: 'Generator API documentation',
  };
  app.get('/openapi.json', (_req, res) =>
    res.set('Cache-Control', 'no-store').json(document),
  );
  app.use(
    '/docs',
    helmet.contentSecurityPolicy({
      directives: { 'upgrade-insecure-requests': null },
    }),
    swaggerUi.serveFiles(undefined, options),
    swaggerUi.setup(undefined, options),
  );
}
