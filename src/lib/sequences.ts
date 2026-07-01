import { db, type AppSettings } from '@/lib/db';

/** Financial year start year for a given date (India: April–March). */
export function getFYStartYear(date: Date = new Date(), fyStartMonth = 4): number {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  return month >= fyStartMonth ? year : year - 1;
}

/** "2024-25" style financial year label. */
export function getCurrentFY(date: Date = new Date(), fyStartMonth = 4): string {
  const start = getFYStartYear(date, fyStartMonth);
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, '0')}`;
}

/** Inclusive ISO date range for a FY label like "2024-25". */
export function fyDateRange(fy: string, fyStartMonth = 4): { start: string; end: string } {
  const startYear = Number(fy.split('-')[0]);
  const start = new Date(startYear, fyStartMonth - 1, 1);
  const end = new Date(startYear + 1, fyStartMonth - 1, 0); // last day of prior month next year
  return {
    start: toISODate(start),
    end: toISODate(end),
  };
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type SequenceField = 'saleSequence' | 'purchaseSequence' | 'expenseSequence';

/**
 * Claim the next document number inside an existing Dexie rw transaction
 * that already includes db.settings.
 */
export async function nextDocumentNumberTx(
  field: SequenceField,
  prefix: string,
  docDate?: string,
): Promise<string> {
  const settings = await db.settings.get('singleton');
  if (!settings) throw new Error('Settings not initialised');
  const refDate = docDate ? new Date(`${docDate}T12:00:00`) : new Date();
  const fyYear = getFYStartYear(refDate, settings.fyStartMonth);

  const patch: Partial<AppSettings> = {};
  let base = settings[field] ?? 0;
  const storedFY = settings.sequenceFY ?? fyYear;

  if (fyYear > storedFY) {
    patch.saleSequence = 0;
    patch.purchaseSequence = 0;
    patch.expenseSequence = 0;
    patch.sequenceFY = fyYear;
    base = 0;
  }

  const next = base + 1;
  patch[field] = next;
  await db.settings.update('singleton', patch);

  const suffix = settings.deviceId ? `-${settings.deviceId}` : '';
  return `${prefix}-${fyYear}-${String(next).padStart(3, '0')}${suffix}`;
}

async function nextNumber(
  field: SequenceField,
  prefix: string,
  docDate?: string,
): Promise<string> {
  let result = '';
  await db.transaction('rw', db.settings, async () => {
    result = await nextDocumentNumberTx(field, prefix, docDate);
  });
  return result;
}

export const getNextSaleNumber = (docDate?: string): Promise<string> =>
  nextNumber('saleSequence', 'SALE', docDate);
export const getNextPurchaseNumber = (docDate?: string): Promise<string> =>
  nextNumber('purchaseSequence', 'PUR', docDate);
export const getNextExpenseNumber = (docDate?: string): Promise<string> =>
  nextNumber('expenseSequence', 'EXP', docDate);
