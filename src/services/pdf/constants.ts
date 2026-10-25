export const PdfFormat = {
  A3: 'A3',
  A4: 'A4',
  A5: 'A5',
  A6: 'A6',
  Letter: 'Letter',
  Legal: 'Legal',
  Tabloid: 'Tabloid',
  Ledger: 'Ledger',
} as const;

export const PdfMedia = {
  Print: 'print',
  Screen: 'screen',
} as const;

export const HTTP_PROTOCOLS = ['http:', 'https:'] as const;

export const HIDE_IMAGES_CSS =
  'img, svg, canvas, video, picture, input[type="image"] { visibility: hidden !important; } * , *::before, *::after { background-image: none !important; list-style-image: none !important; border-image-source: none !important; }';

export const PdfErrorMessage = {
  InvalidRoute: 'Route must belong to the configured webapp',
  RenderTimeout: 'Webapp rendering timed out',
  NavigationBlocked: 'Webapp navigation left the configured origin or opened another page',
  UpstreamError: 'Webapp returned an unsuccessful response',
} as const;
