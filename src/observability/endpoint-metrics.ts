import { UNMATCHED_ROUTE } from '@/http/constants';

import type { Request } from 'express';

const DURATION_WINDOW = 256;
const timingFields = ['durationMs', 'queueWaitMs', 'generationMs', 'outputBytes'] as const;
type TimingField = (typeof timingFields)[number];
type Completion = Record<TimingField, number> & {
  route: string;
  method: string;
  status: number;
};

function createSummary(route: string, method: string) {
  return {
    route,
    method,
    requests: 0,
    failures: 0,
    abortedRequests: 0,
    inFlight: 0,
    byStatus: {} as Record<string, number>,
    lastRequestedAt: null as string | null,
    durationMs: { total: 0, average: 0, max: 0 },
    queueWaitMs: { total: 0, average: 0, max: 0 },
    generationMs: { total: 0, average: 0, max: 0 },
    outputBytes: { total: 0, average: 0, max: 0 },
  };
}

/** Lifetime summaries with a bounded recent-duration window; no request values are exposed. */
export function createEndpointMetrics() {
  const totals = new Map<
    string,
    { summary: ReturnType<typeof createSummary>; durations: number[] }
  >();
  const active = new Map<Request, string>();
  const keyFor = (route: string, method: string) => JSON.stringify([route, method]);

  return {
    start(req: Request) {
      const requestedAt = new Date().toISOString();
      active.set(req, requestedAt);
      return (event: Completion, aborted: boolean) => {
        active.delete(req);
        const key = keyFor(event.route, event.method);
        const entry = totals.get(key) ?? {
          summary: createSummary(event.route, event.method),
          durations: [],
        };
        const { summary, durations } = entry;
        summary.requests++;
        if (event.status >= 400) summary.failures++;
        if (aborted) summary.abortedRequests++;
        summary.byStatus[event.status] = (summary.byStatus[event.status] ?? 0) + 1;
        if (!summary.lastRequestedAt || requestedAt > summary.lastRequestedAt) {
          summary.lastRequestedAt = requestedAt;
        }
        for (const field of timingFields) {
          const timing = summary[field];
          timing.total += event[field];
          timing.average = timing.total / summary.requests;
          timing.max = Math.max(timing.max, event[field]);
        }
        durations[(summary.requests - 1) % DURATION_WINDOW] = event.durationMs;
        totals.set(key, entry);
      };
    },
    snapshot() {
      const result = new Map(
        Array.from(totals, ([key, { summary, durations }]) => {
          const sorted = [...durations].sort((a, b) => a - b);
          return [
            key,
            {
              ...summary,
              durationMs: {
                ...summary.durationMs,
                p95: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
              },
            },
          ];
        }),
      );
      for (const [req, requestedAt] of active) {
        const route = typeof req.route?.path === 'string' ? req.route.path : UNMATCHED_ROUTE;
        const key = keyFor(route, req.method);
        const summary = result.get(key) ?? {
          ...createSummary(route, req.method),
          durationMs: { total: 0, average: 0, max: 0, p95: null },
        };
        summary.inFlight++;
        if (!summary.lastRequestedAt || requestedAt > summary.lastRequestedAt) {
          summary.lastRequestedAt = requestedAt;
        }
        result.set(key, summary);
      }
      return Array.from(result.values());
    },
  };
}
