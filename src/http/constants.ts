export const ExportFormat = {
  Pdf: 'pdf',
  Pptx: 'pptx',
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ContentType = {
  [ExportFormat.Pdf]: 'application/pdf',
  [ExportFormat.Pptx]: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export const HttpMethod = {
  Get: 'GET',
  Head: 'HEAD',
} as const;

export const HttpHeader = {
  AccessControlAllowHeaders: 'Access-Control-Allow-Headers',
  AccessControlAllowMethods: 'Access-Control-Allow-Methods',
  AccessControlAllowOrigin: 'Access-Control-Allow-Origin',
  AccessControlExposeHeaders: 'Access-Control-Expose-Headers',
  AccessControlMaxAge: 'Access-Control-Max-Age',
  AccessControlRequestMethod: 'Access-Control-Request-Method',
  CacheControl: 'Cache-Control',
  ContentDisposition: 'Content-Disposition',
  Origin: 'Origin',
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

export const HttpErrorMessage = {
  EndpointNotFound: 'Endpoint not found',
  InvalidRequestParameters: 'Invalid request parameters',
  DocumentGenerationFailed: 'Document generation failed',
  BodyTooLarge: 'Request body is too large',
  InvalidJson: 'Invalid JSON body',
  UnsupportedCharset: 'Unsupported JSON charset',
  UnsupportedContentEncoding: 'Unsupported content encoding',
} as const;

export const UNMATCHED_ROUTE = 'unmatched';
