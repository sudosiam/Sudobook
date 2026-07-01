import { format, formatDistanceToNow, parseISO } from 'date-fns';

/** User-friendly date: "15 Mar 2024" from ISO YYYY-MM-DD. */
export function formatDisplayDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'd MMM yyyy');
  } catch {
    return isoDate;
  }
}

/** Relative sync time: "5 minutes ago" from ISO timestamp. */
export function formatSyncAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return null;
  }
}
