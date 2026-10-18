import { CacheControlValue, HttpHeader } from '@/http/constants';

import type { RouteFactory } from '@/http/types';

const health: RouteFactory = () => (_req, res) => {
  res
    .set(HttpHeader.CacheControl, CacheControlValue.NoStore)
    .json({ status: 'ok' });
};

export default health;
