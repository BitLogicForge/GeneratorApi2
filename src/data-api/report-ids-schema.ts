import { z } from 'zod';
import { documentIdSchema } from '../pdf-route.ts';

export const reportIdsSchema = z.object({ ids: z.array(documentIdSchema) });
