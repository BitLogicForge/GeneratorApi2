export function resolvePdfRoute(pattern: string, id: string) {
  return pattern.replaceAll('{id}', encodeURIComponent(id));
}
