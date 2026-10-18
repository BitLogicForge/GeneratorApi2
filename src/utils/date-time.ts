/** Formats UTC date/time to the minute; filename-safe output uses hyphens. */
export function formatDateTime(
  date = new Date(),
  {
    format = 'datetime',
    filenameSafe = false,
  }: {
    format?: 'date' | 'time' | 'datetime';
    filenameSafe?: boolean;
  } = {},
): string {
  const iso = date.toISOString();
  const day = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  const value =
    format === 'date' ? day : format === 'time' ? time : `${day} ${time}`;
  return filenameSafe ? value.replace(/[ :]/g, '-') : value;
}
