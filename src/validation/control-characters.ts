/** Detects ASCII control characters (U+0000–U+001F) before URL parsing can strip them. */
export function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}
