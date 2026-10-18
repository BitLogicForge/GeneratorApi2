import { z } from 'zod';

import { documentIdSchema } from '@/validation/schema';

export const reportIdsSchema = z.object({ ids: z.array(documentIdSchema) });
