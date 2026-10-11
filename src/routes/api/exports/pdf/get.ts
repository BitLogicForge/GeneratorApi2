import { generationInput } from '@/http/input';
import { pdfSchema } from '@/schemas/pdf';

import { createPdfHandler } from './handler.ts';

import type { RouteDependencies } from '@/http/types';

/** Arbitrary-page input already matches the renderer contract. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: pdfSchema,
    readInput: generationInput,
    prepareInput: (input) => input,
  });
}
