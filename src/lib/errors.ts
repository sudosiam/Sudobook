/**
 * Translate low-level Dexie/IndexedDB errors into messages a shop owner can
 * actually act on, instead of raw browser text like "TransactionInactiveError".
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    switch (err.name) {
      case 'DatabaseClosedError':
        return 'This tab is out of date — reload the page to continue (a newer version was opened elsewhere).';
      case 'VersionError':
        return 'App data was upgraded in another tab. Please reload this page.';
      case 'QuotaExceededError':
        return 'Device storage is full. Free up space or export a backup and clear old data.';
      case 'TransactionInactiveError':
      case 'InvalidStateError':
        return 'A background save was interrupted. Please try again — if it keeps happening, reload the page.';
      case 'ConstraintError':
        return 'That value is already used by another record.';
      default:
        return err.message || fallback;
    }
  }
  return fallback;
}
