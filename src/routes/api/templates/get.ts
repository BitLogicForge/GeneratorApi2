import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  templateCatalog = [],
}: RouteDependencies): RequestHandler {
  return (_req, res) => res.json({ templates: templateCatalog });
}
