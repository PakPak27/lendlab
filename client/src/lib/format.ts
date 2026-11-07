// All times are stored in UTC and shown in Bangkok time (SRS assumption A-04).
const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// e.g. "14 Nov 2026, 10:15"
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
