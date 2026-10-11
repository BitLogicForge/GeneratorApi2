import { AppError } from '@/errors';

export interface QueueOptions {
  concurrency: number;
  maxPending: number;
  waitTimeoutMs: number;
}
interface PendingJob {
  start(): void;
  reject(error: Error): void;
  cleanup(): void;
}

/** FIFO admission control. Active tasks keep their slot until they actually finish. */
export class GenerationQueue {
  private active = 0;
  private pending: PendingJob[] = [];
  private accepting = true;

  constructor(private readonly options: QueueOptions) {
    for (const [key, value] of Object.entries(options)) {
      if (
        !Number.isSafeInteger(value) ||
        value < (key === 'maxPending' ? 0 : 1)
      ) {
        throw new Error(`Invalid queue option: ${key}`);
      }
    }
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
        new AppError(503, 'QUEUE_CLOSED', 'Server is shutting down'),
      );
    if (signal?.aborted)
      return Promise.reject(
        new AppError(499, 'REQUEST_CANCELLED', 'Request was cancelled'),
      );
    if (
      this.active >= this.options.concurrency &&
      this.pending.length >= this.options.maxPending
    ) {
      return Promise.reject(
        new AppError(
          503,
          'QUEUE_FULL',
          'Generation queue is full; retry shortly',
        ),
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
        remove(new AppError(499, 'REQUEST_CANCELLED', 'Request was cancelled'));
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
                'QUEUE_WAIT_TIMEOUT',
                'Generation queue wait timed out; retry shortly',
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
  close() {
    this.accepting = false;
    for (const job of this.pending.splice(0)) {
      job.cleanup();
      job.reject(new AppError(503, 'QUEUE_CLOSED', 'Server is shutting down'));
    }
  }
}

export interface GenerationQueues {
  pdf: GenerationQueue;
  presentations: GenerationQueue;
}
export function createGenerationQueues(
  options: {
    pdfConcurrency?: number;
    presentationConcurrency?: number;
    maxPending?: number;
    waitTimeoutMs?: number;
  } = {},
): GenerationQueues {
  const common = {
    maxPending: options.maxPending ?? 200,
    waitTimeoutMs: options.waitTimeoutMs ?? 120000,
  };
  return {
    pdf: new GenerationQueue({
      ...common,
      concurrency: options.pdfConcurrency ?? 2,
    }),
    presentations: new GenerationQueue({
      ...common,
      concurrency: options.presentationConcurrency ?? 4,
    }),
  };
}
