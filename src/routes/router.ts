import { Router } from 'express';

import createHealthHandler from './health/get.ts';
import createMetricsHandler from './internal/metrics/get.ts';
import createReadyHandler from './internal/ready/get.ts';
import example from './pdf/example/report.ts';
import factsheet from './pdf/factsheet/[id]/report.ts';
import onepager from './pdf/onepager/[id]/report.ts';
import quarterly from './pdf/quarterly/report.ts';
import daa from './pptx/daa/report.ts';
import tma from './pptx/tma/report.ts';
import brief from './pptxgenjs/brief/report.ts';

import type { RouteDependencies } from '@/http/types';

/** Registers public URLs explicitly; report factories own validation and downloads. */
export function createRouter(dependencies: RouteDependencies) {
  const router = Router();
  router.get('/health', createHealthHandler());
  router.get('/internal/metrics', createMetricsHandler(dependencies));
  router.get('/internal/ready', createReadyHandler(dependencies));
  router.get('/pdf/example', example(dependencies));
  router.get('/pdf/factsheet/:id', factsheet(dependencies));
  router.get('/pdf/onepager/:id', onepager(dependencies));
  router.get('/pdf/quarterly', quarterly(dependencies));
  router.get('/pptx/daa', daa(dependencies));
  router.get('/pptx/tma', tma(dependencies));
  const briefHandler = brief(dependencies);
  router.get('/pptxgenjs/brief', briefHandler);
  router.post('/pptxgenjs/brief', briefHandler);
  return router;
}
