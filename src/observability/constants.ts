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
  RequestRejected: 'request_rejected',
  RequestAbandoned: 'request_abandoned',
  TemplateValidationFailed: 'template_validation_failed',
  ShutdownStarted: 'shutdown_started',
  ShutdownCompleted: 'shutdown_completed',
  ShutdownFailed: 'shutdown_failed',
  ShutdownDeadlineExceeded: 'shutdown_deadline_exceeded',
  BrowserWarmupFailed: 'browser_warmup_failed',
  PdfPageRequested: 'pdf_page_requested',
  PdfPageLoaded: 'pdf_page_loaded',
  PdfPageNavigationFailed: 'pdf_page_navigation_failed',
} as const;

export interface ReadinessState {
  ready: boolean;
  shuttingDown: boolean;
  templates: TemplateState | typeof ManagedExternally;
  renderer: RendererState | typeof ManagedExternally;
}
