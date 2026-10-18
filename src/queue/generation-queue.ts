import { queueDefaults } from '@/config';
import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { QueueErrorMessage } from './constants.ts';
import { queueOptionsSchema } from './schema.ts';

import type { QueueOptions } from './schema.ts';

export type { QueueOptions };
interface PendingJob {
  start(): void;
  reject(error: Error): void;
  cleanup(): void;
}

/** FIFO admission control. Active tasks keep their slot until they actually finish. */
export class GenerationQueue {
  private readonly options: QueueOptions;
  private active = 0;
  private pending: PendingJob[] = [];
  private accepting = true;
  private drainPromise: Promise<void> | undefined;
  private resolveDrain: (() => void) | undefined;

  constructor(options: QueueOptions) {
    const result = queueOptionsSchema.safeParse(options);
    if (!result.success) {
      const key = result.error.issues[0].path[0] ?? 'options';
      throw new Error(`Invalid queue option: ${String(key)}`);
    }
    this.options = result.data;
  }

  get stats() {
    return {
      active: this.active,
      pending: this.pending.length,
      concurrency: this.options.concurrency,
      maxPending: this.options.maxPending,
      accepting: this.accepting,
    };
  }

  /** Bounds execution and waiting; cancellation and wait timeouts remove only pending jobs. */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!this.accepting)
      return Promise.reject(
        new AppError(
          503,
          ErrorCode.QueueClosed,
          QueueErrorMessage.ServerShuttingDown,
        ),
      );
    if (signal?.aborted)
      return Promise.reject(
        new AppError(
          499,
          ErrorCode.RequestCancelled,
          QueueErrorMessage.RequestCancelled,
        ),
      );
    if (
      this.active >= this.options.concurrency &&
      this.pending.length >= this.options.maxPending
    ) {
      return Promise.reject(
        new AppError(503, ErrorCode.QueueFull, QueueErrorMessage.QueueFull),
      );
    }
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const remove = (error: AppError) => {
        const index = this.pending.indexOf(job);
        if (index < 0) return;
        this.pending.splice(index, 1);
        job.cleanup();
        reject(error);
      };
      const onAbort = () =>
        remove(
          new AppError(
            499,
            ErrorCode.RequestCancelled,
            QueueErrorMessage.RequestCancelled,
          ),
        );
      const job: PendingJob = {
        reject,
        cleanup: () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
        },
        start: () => {
          job.cleanup();
          this.active++;
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.pump();
              if (this.active === 0) this.resolveDrain?.();
            });
        },
      };
      if (this.active < this.options.concurrency) job.start();
      else {
        this.pending.push(job);
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(
          () =>
            remove(
              new AppError(
                503,
                ErrorCode.QueueWaitTimeout,
                QueueErrorMessage.QueueWaitTimeout,
              ),
            ),
          this.options.waitTimeoutMs,
        );
      }
    });
  }

  private pump() {
    while (this.active < this.options.concurrency && this.pending.length)
      this.pending.shift()!.start();
  }

  /** Reject waiting jobs during shutdown; already running tasks are allowed to finish. */
  close(): Promise<void> {
    this.accepting = false;
    for (const job of this.pending.splice(0)) {
      job.cleanup();
      job.reject(
        new AppError(
          503,
          ErrorCode.QueueClosed,
          QueueErrorMessage.ServerShuttingDown,
        ),
      );
    }
    if (this.active === 0) return Promise.resolve();
    return (this.drainPromise ??= new Promise<void>((resolve) => {
      this.resolveDrain = resolve;
    }));
  }
}

export interface GenerationQueues {
  pdf: GenerationQueue;
  presentations: GenerationQueue;
}
export function createGenerationQueues(
  options: Partial<typeof queueDefaults> = {},
): GenerationQueues {
  const common = {
    maxPending: options.maxPending ?? queueDefaults.maxPending,
    waitTimeoutMs: options.waitTimeoutMs ?? queueDefaults.waitTimeoutMs,
  };
  return {
    pdf: new GenerationQueue({
      ...common,
      concurrency: options.concurrency ?? queueDefaults.concurrency,
    }),
    presentations: new GenerationQueue({
      ...common,
      concurrency:
        options.presentationConcurrency ??
        queueDefaults.presentationConcurrency,
    }),
  };
}
