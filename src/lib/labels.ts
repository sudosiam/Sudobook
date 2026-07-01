import type { PaymentMethod } from '@/lib/db';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
  upi: 'UPI',
  partial: 'Partial Payment',
  credit: 'On Credit',
};
