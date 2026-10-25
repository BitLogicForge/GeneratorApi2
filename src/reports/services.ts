import { loadConfig } from '@/config';
import { TemplateState } from '@/observability/constants';
import { DataApiClient } from '@/services/data-api-client';

import type { Config } from '@/config';

export interface ReportContext {
  config: Config;
  dataApi: DataApiClient<Config['dataApi']['endpoints']>;
}

export interface ReportService<Input> {
  /** `signal` aborts when the client disconnects; services should stop between steps. */
  generate(input: Input, signal?: AbortSignal): Promise<Buffer>;
  validate?(): Promise<void>;
  close?(): Promise<void>;
}

export interface ServiceDefinition<Input> {
  createService(context: ReportContext): ReportService<Input>;
}

interface Entry {
  service: unknown;
  validate(): Promise<void>;
  close(): Promise<void>;
}

/** One service per report per application, including shared GET/POST factories. */
export class ReportServices {
  private readonly entries = new Map<object, Entry>();
  private readonly overrides = new Map<object, unknown>();
  private initialization: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private state: TemplateState = TemplateState.Validating;

  constructor(private readonly context: ReportContext) {}

  get config() {
    return this.context.config;
  }

  get stats() {
    return { state: this.state };
  }

  /** Overrides are externally managed, keeping HTTP tests free of real services. */
  override<Input>(definition: ServiceDefinition<Input>, service: ReportService<Input>) {
    if (this.entries.has(definition) || this.initialization || this.closing)
      throw new Error('Override report services before registering routes');
    this.overrides.set(definition, service);
    return this;
  }

  get<Input>(definition: ServiceDefinition<Input>): ReportService<Input> {
    if (this.closing) throw new Error('Report services are shutting down');
    const existing = this.entries.get(definition);
    if (existing) return existing.service as ReportService<Input>;
    if (this.initialization) throw new Error('Register report services before initialization');
    const override = this.overrides.get(definition) as ReportService<Input> | undefined;
    const service = override ?? definition.createService(this.context);
    this.entries.set(definition, {
      service,
      validate: async () => {
        if (!override) await service.validate?.();
      },
      close: async () => {
        if (!override) await service.close?.();
      },
    });
    return service;
  }

  initialize(): Promise<void> {
    this.initialization ??= Promise.allSettled(
      [...this.entries.values()].map((entry) => entry.validate()),
    ).then((results) => {
      const errors = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason as unknown] : [],
      );
      if (errors.length) {
        this.state = TemplateState.Failed;
        throw new AggregateError(
          errors,
          `${errors.length} report service(s) failed template validation`,
        );
      }
      this.state = TemplateState.Ready;
    });
    return this.initialization;
  }

  close(): Promise<void> {
    this.closing ??= (async () => {
      await this.initialization?.catch(() => {});
      const results = await Promise.allSettled(
        [...this.entries.values()].map((entry) => entry.close()),
      );
      const errors = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason as unknown] : [],
      );
      if (errors.length) throw new AggregateError(errors, 'Report shutdown failed');
    })();
    return this.closing;
  }
}

export function createReportServices(config = loadConfig({})) {
  return new ReportServices({
    config,
    dataApi: new DataApiClient(config.dataApi),
  });
}
