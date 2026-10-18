export const ExportFormat = {
  Pdf: 'pdf',
  Pptx: 'pptx',
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ContentType = {
  [ExportFormat.Pdf]: 'application/pdf',
  [ExportFormat.Pptx]:
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export const HttpMethod = {
  Get: 'GET',
  Head: 'HEAD',
} as const;

export const HttpHeader = {
  CacheControl: 'Cache-Control',
  RequestId: 'X-Request-Id',
  RetryAfter: 'Retry-After',
} as const;

export const CacheControlValue = {
  NoStore: 'no-store',
} as const;

export const ParserErrorType = {
  EntityTooLarge: 'entity.too.large',
  EntityParseFailed: 'entity.parse.failed',
  CharsetUnsupported: 'charset.unsupported',
  EncodingUnsupported: 'encoding.unsupported',
} as const;

export const UNMATCHED_ROUTE = 'unmatched';
