import { Select } from '@/components/common/Field';
import type { Account } from '@/lib/db';

interface AccountCategorySelectProps {
  accounts: Account[] | undefined;
  value: number | undefined;
  onChange: (code: number, name: string) => void;
  emptyLabel?: string;
}

export function AccountCategorySelect({
  accounts,
  value,
  onChange,
  emptyLabel = 'No categories available',
}: AccountCategorySelectProps) {
  if (!accounts) {
    return (
      <Select disabled value="">
        <option value="">Loading…</option>
      </Select>
    );
  }

  if (accounts.length === 0) {
    return (
      <Select disabled value="">
        <option value="">{emptyLabel}</option>
      </Select>
    );
  }

  const selected = accounts.some((a) => a.code === value) ? value : accounts[0].code;

  return (
    <Select
      value={selected}
      onChange={(e) => {
        const code = Number(e.target.value);
        const acc = accounts.find((a) => a.code === code);
        onChange(code, acc?.name ?? '');
      }}
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.code}>
          {a.name}
        </option>
      ))}
    </Select>
  );
}
