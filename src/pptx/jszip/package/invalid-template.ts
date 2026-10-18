import { ErrorCode, ErrorMessage } from '@/constants';
import { AppError } from '@/errors';

export const invalidTemplate = (
  message: string = ErrorMessage.InvalidTemplateObjects,
) => new AppError(500, ErrorCode.InvalidTemplate, message);
