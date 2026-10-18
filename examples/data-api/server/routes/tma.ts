import { randomInt } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { createRandomDataGenerator } from '@/utils/random-data';
import { documentTextSchema } from '@/validation/schema';

const generateData = createRandomDataGenerator(1);

const seriesQuerySchema = z
  .object({
    pp1: documentTextSchema.max(5000).default('Generated report'),
  })
  .strict();

const breakdownQuerySchema = z
  .object({
    pp2: documentTextSchema.max(5000).default('Generated report'),
  })
  .strict();

export function createTmaRoute() {
  const router = Router();

  router.get('/tma/series', (req, res) => {
    const query = seriesQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'Invalid TMA series parameters' });
      return;
    }
    res.json({
      pp1: query.data.pp1,
      asOf: new Date().toISOString(),
      title: `CHART A (${query.data.pp1})`,
      values: generateData(20),
    });
  });

  router.get('/tma/breakdown', (req, res) => {
    const query = breakdownQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'Invalid TMA breakdown parameters' });
      return;
    }
    const values = generateData(4);
    const colors = values.map(() =>
      randomInt(0x1000000).toString(16).toUpperCase().padStart(6, '0'),
    );
    res.json({
      pp2: query.data.pp2,
      title: `CHART B (${query.data.pp2})`,
      values,
      colors,
    });
  });

  return router;
}
