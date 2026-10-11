import { createPdfHandler } from '../handler.ts';
import { inputSchema, readInput } from './schema.ts';

import type { RouteDependencies } from '@/http/types';

/** Arbitrary-page input already matches the renderer contract. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: inputSchema,
    readInput,
    prepareInput: (input) => input,
  });
}
