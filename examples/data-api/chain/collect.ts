import type { Config } from '../../../src/config.ts';
import type {
  DataApiClient,
  DataApiQuery,
} from '../../../src/services/data-api-client.ts';

/** Each response is validated before its values are used by the next request. */
export async function fetchReportDataChain(
  api: DataApiClient<Config['dataApi']['endpoints']>,
  id: string,
  query: DataApiQuery,
) {
  const summary = await api.get('reportSummary', { id }, query);
  const customer = await api.get('customer', { id: summary.customerId });
  const report = await api.get(
    'report',
    { id: summary.id },
    { language: summary.language, year: summary.year },
  );
  return { summary, customer, report };
}
