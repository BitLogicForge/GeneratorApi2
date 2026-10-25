import { environmentSchema } from './schema.ts';

import type { Environment } from './schema.ts';

/** Validates environment values once, before any services start. */
export function readEnvironment(env: NodeJS.ProcessEnv): Environment {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }
  return result.data;
}
