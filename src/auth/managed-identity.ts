import { ManagedIdentityCredential } from '@azure/identity';
import { z } from 'zod';

/** Creates an Azure-hosted workload credential without secrets or interactive fallback. */
export function createAzureCredential(env: NodeJS.ProcessEnv = process.env) {
  const clientId = env.AZURE_CLIENT_ID?.trim();
  if (!clientId) return undefined;
  return new ManagedIdentityCredential({ clientId: z.guid().parse(clientId) });
}
