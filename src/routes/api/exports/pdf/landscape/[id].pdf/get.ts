import { createDocumentPdfHandler } from '../../document-handler.ts';

import type { RouteDependencies } from '@/http/types';

/** Document link that always prints in landscape orientation. */
export default function createHandler(dependencies: RouteDependencies) {
  return createDocumentPdfHandler(dependencies, true);
}
