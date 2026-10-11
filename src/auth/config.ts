import { z } from 'zod';

/** Only explicit entra mode enables protection; disabled preserves the local demo. */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = z
    .enum(['disabled', 'entra'])
    .default('disabled')
    .parse(env.AUTH_MODE);
  if (mode === 'disabled') return { mode } as const;
  const config = z
    .object({
      ENTRA_TENANT_ID: z.guid().toLowerCase(),
      ENTRA_API_CLIENT_ID: z.guid().toLowerCase(),
      ENTRA_API_SCOPE: z
        .string()
        .regex(/^[A-Za-z0-9_.-]+$/)
        .default('access_as_user'),
    })
    .parse(env);
  return {
    mode,
    tenantId: config.ENTRA_TENANT_ID,
    audience: config.ENTRA_API_CLIENT_ID,
    scope: config.ENTRA_API_SCOPE,
  } as const;
}

export type AuthConfig = ReturnType<typeof loadAuthConfig>;
