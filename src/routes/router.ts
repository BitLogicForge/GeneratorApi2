import { Router } from 'express';
import sample1 from './pptx/sample1/report.ts';

import health from './health.ts';
import metrics from './internal/metrics.ts';
import ready from './internal/ready.ts';
import example from './pdf/example/report.ts';
import factsheet from './pdf/factsheet/report.ts';
import onepager from './pdf/onepager/report.ts';
import quarterly from './pdf/quarterly/report.ts';
import daa from './pptx/daa/report.ts';
import tma from './pptx/tma/report.ts';
import brief from './pptxgenjs/brief/report.ts';

import type { RouteDependencies } from '@/http/types';

const RoutePath = {
  Health: '/health',
  InternalMetrics: '/internal/metrics',
  InternalReady: '/internal/ready',
  PdfExample: '/pdf/example',
  PdfFactsheet: '/pdf/factsheet/:id',
  PdfOnepager: '/pdf/onepager/:id',
  PdfQuarterly: '/pdf/quarterly',
  PptxDaa: '/pptx/daa',
  PptxTma: '/pptx/tma',
  PptxSample1: '/pptx/sample1',
  PptxGenJsBrief: '/pptxgenjs/brief',
} as const;

/** Registers public URLs explicitly; report factories own validation and downloads. */
export function createRouter(dependencies: RouteDependencies) {
  const router = Router();
  router.get(RoutePath.Health, health(dependencies));
  router.get(RoutePath.InternalMetrics, metrics(dependencies));
  router.get(RoutePath.InternalReady, ready(dependencies));
  router.get(RoutePath.PdfExample, example(dependencies));
  router.get(RoutePath.PdfFactsheet, factsheet(dependencies));
  router.get(RoutePath.PdfOnepager, onepager(dependencies));
  router.get(RoutePath.PdfQuarterly, quarterly(dependencies));
  router.get(RoutePath.PptxDaa, daa(dependencies));
  router.get(RoutePath.PptxTma, tma(dependencies));
  router.get(RoutePath.PptxSample1, sample1(dependencies));
  const briefHandler = brief(dependencies);
  router.get(RoutePath.PptxGenJsBrief, briefHandler);
  router.post(RoutePath.PptxGenJsBrief, briefHandler);
  return router;
}
