import { AppError } from '@/errors';

export const invalidTemplate = () =>
  new AppError(
    500,
    'INVALID_TEMPLATE',
    'Presentation template has missing, duplicate, or unsupported objects or data',
  );
