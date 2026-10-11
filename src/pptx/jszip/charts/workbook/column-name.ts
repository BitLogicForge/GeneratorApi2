export function columnName(value: number): string {
  let name = '';
  while (value) {
    value--;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}
