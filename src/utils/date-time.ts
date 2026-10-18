export const DateTimeFormat = {
  Date: 'date',
  Time: 'time',
  DateTime: 'datetime',
} as const;

export type DateTimeFormat =
  (typeof DateTimeFormat)[keyof typeof DateTimeFormat];

/** Formats UTC date/time to the minute; filename-safe output uses hyphens. */
export function formatDateTime(
  date = new Date(),
  {
    format = DateTimeFormat.DateTime,
    filenameSafe = false,
  }: {
    format?: DateTimeFormat;
    filenameSafe?: boolean;
  } = {},
): string {
  const iso = date.toISOString();
  const day = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  const value =
    format === DateTimeFormat.Date
      ? day
      : format === DateTimeFormat.Time
        ? time
        : `${day} ${time}`;
  return filenameSafe ? value.replace(/[ :]/g, '-') : value;
}
