import { createPdfHandler } from '../../handler.ts';
import { createDocumentPdfResolver } from './document-pdf.ts';
import { documentPdfRequestSchema } from './schema.ts';

import type { RouteDependencies } from '@/http/types';

/** Document link that always prints in portrait orientation. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: documentPdfRequestSchema,
    readInput: (req) => ({ id: req.params.id, query: req.query }),
    prepareInput: createDocumentPdfResolver(dependencies.config),
  });
}
