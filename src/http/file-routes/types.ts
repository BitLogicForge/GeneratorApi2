import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';
import type { RouteDocumentation } from '../openapi/route.ts';

export type RouteFactory = ((
  dependencies: RouteDependencies,
) => RequestHandler<Record<string, string>>) & {
  documentation?: RouteDocumentation;
};
export type RouteMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface FileRoute {
  method: RouteMethod;
  path: string;
  file: string;
  factory: RouteFactory;
}
