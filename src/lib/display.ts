import { format, parseISO } from 'date-fns';

/** User-friendly date: "15 Mar 2024" from ISO YYYY-MM-DD. */
export function formatDisplayDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'd MMM yyyy');
  } catch {
    return isoDate;
  }
}
