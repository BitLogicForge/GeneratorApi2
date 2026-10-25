import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { QueueErrorMessage } from './constants.ts';

/** Client went away; `stage` records how far generation got before stopping. */
export function requestCancelled(stage: string) {
  return new AppError(499, ErrorCode.RequestCancelled, QueueErrorMessage.RequestCancelled, {
    details: { stage },
  });
}

/** Stops generation between steps once the client has disconnected. */
export function throwIfCancelled(signal: AbortSignal | undefined, stage: string) {
  if (signal?.aborted) throw requestCancelled(stage);
}
