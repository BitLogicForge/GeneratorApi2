import type { RouteFactory } from '@/http/types';

const health: RouteFactory = () => (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ status: 'ok' });
};

export default health;
