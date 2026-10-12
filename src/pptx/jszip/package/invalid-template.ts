import { AppError } from '@/errors';

export const invalidTemplate = (
  message = 'Presentation template has missing, duplicate, or unsupported objects or data',
) => new AppError(500, 'INVALID_TEMPLATE', message);
