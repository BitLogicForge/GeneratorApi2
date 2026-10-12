// Stable public imports; configuration implementation is kept in focused modules.
export { loadConfig } from './config/index.ts';
export type { Config } from './config/index.ts';
export { dataApiCacheDefaults } from './config/defaults.ts';
export { resolvePdfPrintSettings } from './services/pdf/contracts.ts';
