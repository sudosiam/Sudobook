import { useLiveQuery } from '@/hooks/useLiveQuery';
import { db, type AppSettings } from '@/lib/db';

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.settings.get('singleton'));
}
