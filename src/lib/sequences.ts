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

async function nextNumber(
  field: 'saleSequence' | 'purchaseSequence' | 'expenseSequence',
  prefix: string,
  docDate?: string,
): Promise<string> {
  let result = '';
  await db.transaction('rw', db.settings, async () => {
    const settings = await db.settings.get('singleton');
    if (!settings) throw new Error('Settings not initialised');
    const refDate = docDate ? new Date(`${docDate}T12:00:00`) : new Date();
    const fyYear = getFYStartYear(refDate, settings.fyStartMonth);

    const patch: Partial<AppSettings> = {};
    let base = settings[field] ?? 0;

    // Reset every counter at the financial-year boundary (India: April 1).
    // Only reset moving forward to avoid a backdated document ping-ponging
    // the counters between years.
    if ((settings.sequenceFY ?? fyYear) < fyYear) {
      patch.saleSequence = 0;
      patch.purchaseSequence = 0;
      patch.expenseSequence = 0;
      base = 0;
    }
    if (settings.sequenceFY !== fyYear) {
      patch.sequenceFY = fyYear;
    }

    const next = base + 1;
    patch[field] = next;
    await db.settings.update('singleton', patch);
    // Per-device suffix keeps numbers unique even if two devices increment the
    // same local sequence while offline (they sync later without collisions).
    const suffix = settings.deviceId ? `-${settings.deviceId}` : '';
    result = `${prefix}-${fyYear}-${String(next).padStart(3, '0')}${suffix}`;
  });
  return result;
}

export const getNextSaleNumber = (docDate?: string): Promise<string> =>
  nextNumber('saleSequence', 'SALE', docDate);
export const getNextPurchaseNumber = (docDate?: string): Promise<string> =>
  nextNumber('purchaseSequence', 'PUR', docDate);
export const getNextExpenseNumber = (docDate?: string): Promise<string> =>
  nextNumber('expenseSequence', 'EXP', docDate);
