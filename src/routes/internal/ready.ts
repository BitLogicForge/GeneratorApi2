import { CacheControlValue, HttpHeader } from '@/http/constants';
import {
  ManagedExternally,
  RendererState,
  TemplateState,
} from '@/observability/constants';

import type { RouteDependencies, RouteFactory } from '@/http/types';
import type { ReadinessState } from '@/observability/constants';

function evaluateReadiness({
  readiness,
  reports,
  pdf,
  queues,
}: RouteDependencies): ReadinessState {
  const accepting =
    queues.pdf.stats.accepting && queues.presentations.stats.accepting;
  if (readiness) {
    const state = readiness();
    return {
      ...state,
      ready: state.ready && accepting,
      shuttingDown: state.shuttingDown || !accepting,
    };
  }
  const templates = reports?.stats.state ?? ManagedExternally;
  const renderer = pdf.stats?.state ?? ManagedExternally;
  const shuttingDown = !accepting;
  const ready =
    !shuttingDown &&
    (templates === TemplateState.Ready || templates === ManagedExternally) &&
    (renderer === RendererState.Ready || renderer === ManagedExternally);
  return { ready, shuttingDown, templates, renderer };
}

const ready: RouteFactory = (dependencies) => (_req, res) => {
  const state = evaluateReadiness(dependencies);
  res
    .set(HttpHeader.CacheControl, CacheControlValue.NoStore)
    .status(state.ready ? 200 : 503)
    .json(state);
};

export default ready;
