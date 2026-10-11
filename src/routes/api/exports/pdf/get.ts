import { generationInput } from '@/http/input';

import { createPdfHandler } from './handler.ts';
import { pdfSchema } from './schema.ts';

import type { RouteDependencies } from '@/http/types';

/** Arbitrary-page input already matches the renderer contract. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: pdfSchema,
    readInput: generationInput,
    prepareInput: (input) => input,
  });
}
