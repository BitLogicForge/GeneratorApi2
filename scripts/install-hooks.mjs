import { existsSync } from 'node:fs';

// Production packages have no dev dependencies; CI does not need local hooks.
if (
  process.env.HUSKY !== '0' &&
  process.env.NODE_ENV !== 'production' &&
  !process.env.CI &&
  !process.env.npm_config_omit?.split(/\s+/).includes('dev') &&
  existsSync('.git')
) {
  const { default: husky } = await import('husky');
  const error = husky();
  if (error) throw new Error(error);
}
