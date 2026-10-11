import type { z } from 'zod';
import type { RouteFactory } from '../file-routes/types.ts';

export interface RouteDocumentation {
  summary: string;
  description?: string;
  tag: string;
  input?: z.ZodObject;
  query?: z.ZodObject;
  params?: z.ZodObject;
  example?: Record<string, unknown>;
  format?: 'pdf' | 'pptx';
  response?: z.ZodType;
  responses?: Record<number, { description: string; schema: z.ZodType }>;
  noStore?: boolean;
}

/** Attaches documentation to the same factory re-exported by GET/POST modules. */
export function documentedRoute<T extends RouteFactory>(
  factory: T,
  documentation: RouteDocumentation,
): T & { documentation: RouteDocumentation } {
  return Object.assign(factory, { documentation });
}
