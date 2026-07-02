/** Strip HTML tags and control characters from user-entered text before storage. */
export function sanitizeText(input: string): string {
  return input
    .replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function sanitizeOptionalText(input: string | undefined): string | undefined {
  if (input == null) return input;
  const cleaned = sanitizeText(input);
  return cleaned === '' ? undefined : cleaned;
}

/** Allow digits and common masking chars only. */
export function sanitizeAccountNumber(input: string): string {
  return input.replace(/[^\dA-Za-z\-*Xx]/g, '').slice(0, 24);
}

/** Mask bank account number for list/detail views (last 4 visible). */
export function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (trimmed === '----' || trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}
