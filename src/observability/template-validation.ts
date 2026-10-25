import { LogEvent } from './constants.ts';
import { serializeError } from './serialize-error.ts';

/** Include every failed template and its original error details in startup logs. */
export function logTemplateValidationFailure(
  error: unknown,
  logger: Pick<Console, 'error'> = console,
) {
  logger.error({
    event: LogEvent.TemplateValidationFailed,
    errors: (error instanceof AggregateError ? error.errors : [error]).map((item: unknown) =>
      serializeError(item),
    ),
  });
}
