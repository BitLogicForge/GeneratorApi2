import { z } from 'zod';
import { documentIdSchema } from '../pdf-route.js';

export const reportIdsSchema = z.object({ ids: z.array(documentIdSchema) });
