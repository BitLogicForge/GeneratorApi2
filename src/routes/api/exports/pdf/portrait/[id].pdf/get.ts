import { createDocumentPdfHandler } from '../../document-handler.ts';

import type { RouteDependencies } from '@/http/types';

/** Document link that always prints in portrait orientation. */
export default function createHandler(dependencies: RouteDependencies) {
  return createDocumentPdfHandler(dependencies, false);
}
