import { z } from 'zod';

import { documentIdSchema } from '@/validation/document-id';

export const reportIdsSchema = z.object({ ids: z.array(documentIdSchema) });
