import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppSettings } from '@/lib/db';

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.settings.get('singleton'));
}
