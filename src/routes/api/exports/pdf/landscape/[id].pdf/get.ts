import { createPdfHandler } from '../../handler.ts';
import { createDocumentPdfResolver } from './document-pdf.ts';
import { readRequestInput, requestSchema } from './schema.ts';

import type { RouteDependencies } from '@/http/types';

/** Document link that always prints in landscape orientation. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: requestSchema,
    readRequestInput,
    prepareInput: createDocumentPdfResolver(dependencies.config),
  });
}
