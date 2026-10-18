import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { PptxErrorMessage } from './constants.ts';

export const invalidTemplate = (
  message: string = PptxErrorMessage.InvalidTemplateObjects,
) => new AppError(500, ErrorCode.InvalidTemplate, message);
