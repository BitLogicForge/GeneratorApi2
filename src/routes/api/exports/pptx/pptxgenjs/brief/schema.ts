import { decodeExportInput } from '@/http/input';
import { briefInputSchema } from '@/services/pptxgenjs/contracts';

import type { Request } from 'express';

export const requestSchema = briefInputSchema;

export function readRequestInput(req: Request) {
  return decodeExportInput(req, ['slides']);
}
