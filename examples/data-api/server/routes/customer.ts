import { Router } from 'express';

import { documentIdSchema } from '@/pdf-route';

export function createCustomerRoute() {
  const router = Router();
  router.get('/customers/:id', (req, res) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success || Object.keys(req.query).length) {
      res.status(400).json({ error: 'Invalid customer parameters' });
      return;
    }
    res.json({
      id: id.data,
      name: 'Acme',
      industry: 'Manufacturing',
      contactEmail: 'reports@example.com',
    });
  });
  return router;
}
