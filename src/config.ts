export const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/documents/{id}',
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    ...documentSettings,
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    baseUrl: env.WEBAPP_BASE_URL ?? 'http://localhost:3001',
    timeout: Number(env.RENDER_TIMEOUT_MS ?? 30000),
    dataApi: {
      baseUrl: env.DATA_API_BASE_URL ?? '',
      token: env.DATA_API_TOKEN,
      timeoutMs: Number(env.DATA_API_TIMEOUT_MS ?? 10000),
    },
  };
}
export type Config = ReturnType<typeof loadConfig>;
