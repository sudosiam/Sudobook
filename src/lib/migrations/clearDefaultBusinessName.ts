import { db } from '@/lib/db';

export const CLEAR_DEFAULT_BUSINESS_NAME_MIGRATION = 'clear-default-business-name-v1';

const LEGACY_DEFAULT = 'Biswajit Power Hub';

/** Clears the old seeded default business name from existing installs. */
export async function clearDefaultBusinessName(): Promise<void> {
  const settings = await db.settings.get('singleton');
  if (!settings || settings.businessName !== LEGACY_DEFAULT) return;
  await db.settings.update('singleton', { businessName: '' });
}
