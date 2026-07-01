import { isDbOutdated } from '@/lib/db';

/** False when this tab lost its Dexie connection (schema upgrade elsewhere). */
export function useDbWritable(): boolean {
  return !isDbOutdated();
}
