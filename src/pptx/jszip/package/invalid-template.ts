import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { PptxErrorMessage } from './constants.ts';

/** Template or document-structure failure; `details` is logged, never sent to clients. */
export const invalidTemplate = (
  message: string = PptxErrorMessage.InvalidTemplateObjects,
  details?: Record<string, unknown>,
) => new AppError(500, ErrorCode.InvalidTemplate, message, { details });
