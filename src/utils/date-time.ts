export const DateTimeFormat = {
  Date: 'date',
  Time: 'time',
  DateTime: 'datetime',
} as const;

export type DateTimeFormat = (typeof DateTimeFormat)[keyof typeof DateTimeFormat];

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
    format === DateTimeFormat.Date ? day : format === DateTimeFormat.Time ? time : `${day} ${time}`;
  return filenameSafe ? value.replace(/[ :]/g, '-') : value;
}

/** Generates `rows` consecutive UTC `YYYY-MM-DD` date strings ending at `asOf`. */
export function generateTimeSeriesDates(rows: number, asOf = new Date()): string[] {
  return Array.from({ length: rows }, (_, index) => {
    const date = new Date(asOf);
    date.setUTCDate(date.getUTCDate() - (rows - 1 - index));
    return formatDateTime(date, { format: DateTimeFormat.Date });
  });
}
