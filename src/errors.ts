import type { ErrorCode } from './constants.ts';

export interface AppErrorOptions extends ErrorOptions {
  /** Diagnostic context written to server logs; never sent to clients. */
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.details = options.details;
  }
}
