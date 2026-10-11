import { documentPdfRequestSchema } from '@/schemas/document-pdf';

import { createDocumentPdfResolver } from '../../document-pdf.ts';
import { createPdfHandler } from '../../handler.ts';

import type { RouteDependencies } from '@/http/types';

/** Document link that always prints in landscape orientation. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: documentPdfRequestSchema,
    readInput: (req) => ({ id: req.params.id, query: req.query }),
    prepareInput: createDocumentPdfResolver(dependencies.config, true),
  });
}
