/** Renderer lifecycle states exposed by metrics and readiness. */
export const RendererState = {
  Idle: 'idle',
  Starting: 'starting',
  Ready: 'ready',
  Disconnected: 'disconnected',
  Failed: 'failed',
} as const;

export type RendererState = (typeof RendererState)[keyof typeof RendererState];

export const TemplateState = {
  Validating: 'validating',
  Ready: 'ready',
  Failed: 'failed',
} as const;

export type TemplateState = (typeof TemplateState)[keyof typeof TemplateState];

/** Injected services may own initialization outside this application. */
export const ManagedExternally = 'managed-externally';

export const LogEvent = {
  RequestCompleted: 'request_completed',
  RequestFailed: 'request_failed',
  TemplateValidationFailed: 'template_validation_failed',
  BrowserWarmupFailed: 'browser_warmup_failed',
} as const;

export interface ReadinessState {
  ready: boolean;
  shuttingDown: boolean;
  templates: TemplateState | typeof ManagedExternally;
  renderer: RendererState | typeof ManagedExternally;
}
