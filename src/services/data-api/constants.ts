export const DataApiErrorMessage = {
  NotConfigured: 'Configure DATA_API_BASE_URL before fetching report data',
  UnknownEndpoint: 'Data API endpoint not configured',
  InvalidRelativePath: 'Use a relative data API path',
  InvalidPrefixPath: 'Path must stay within the configured data API',
  InvalidQuery: 'Numeric query values must be finite',
  InvalidJson: 'Data API returned invalid JSON',
  InvalidSchema: 'Data API response does not match the expected schema',
  Timeout: 'Data API request timed out',
  Unavailable: 'Unable to fetch data from the configured API',
} as const;
