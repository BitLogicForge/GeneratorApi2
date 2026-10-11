import type { z } from 'zod';
import type { Config } from '@/config';
import type { reportDataSchema } from '@/data-api/report-data-schema';
import type { DataApiClient, DataApiQuery } from '@/services/data-api-client';

type Api = DataApiClient<Config['dataApi']['endpoints']>;
type ReportData = z.output<typeof reportDataSchema>;
type ReportEntry = { requestedId: string; data: ReportData };

export function fetchReportDataBatch(
  api: Api,
  query: DataApiQuery,
  mode?: 'dict',
): Promise<Record<string, ReportData>>;
export function fetchReportDataBatch(
  api: Api,
  query: DataApiQuery,
  mode: 'list',
): Promise<ReportEntry[]>;
export function fetchReportDataBatch(
  api: Api,
  query: DataApiQuery,
  mode: 'dict' | 'list',
): Promise<Record<string, ReportData> | ReportEntry[]>;
/** Fetches each distinct ID sequentially; dictionary keys always use the requested ID. */
export async function fetchReportDataBatch(
  api: Api,
  query: DataApiQuery,
  mode: 'dict' | 'list' = 'dict',
) {
  const { ids } = await api.get('reportIds', {});
  const entries: ReportEntry[] = [];
  for (const requestedId of new Set(ids)) {
    const data = await api.get('report', { id: requestedId }, query);
    entries.push({ requestedId, data });
  }
  return mode === 'list'
    ? entries
    : Object.fromEntries(
        entries.map(({ requestedId, data }) => [requestedId, data]),
      );
}
