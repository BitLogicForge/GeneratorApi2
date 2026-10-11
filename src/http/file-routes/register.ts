import type { Express } from 'express';
import type { RouteDependencies } from '@/http/types';
import type { FileRoute } from './types.ts';

export function registerRoutes(
  app: Express,
  routes: FileRoute[],
  dependencies: RouteDependencies,
): void {
  for (const route of routes) {
    const handler = route.factory(dependencies);
    if (typeof handler !== 'function')
      throw new Error(`Route factory must return a handler: ${route.file}`);
    app[route.method](route.path, handler);
  }
}
