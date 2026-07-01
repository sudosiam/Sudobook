import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Customer } from '@/lib/db';
import { useListboxKeyboard } from '@/hooks/useListboxKeyboard';
import { cn } from '@/lib/utils';
import { Field, Input } from '@/components/common/Field';

export function CustomerNameInput({
  value,
  customerId,
  onChange,
  customers,
  error,
  placeholder = 'Customer name',
}: {
  value: string;
  customerId?: string;
  onChange: (name: string, customerId?: string) => void;
  customers: Customer[];
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trimmed = value.trim();

  const suggestions = useMemo(() => {
    const active = customers.filter((c) => c.isActive);
    if (!trimmed) return active.slice(0, 8);
    const q = trimmed.toLowerCase();
    return active.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, trimmed]);

  const listOpen = open && suggestions.length > 0;

  const selectCustomer = (c: Customer) => {
    onChange(c.name, c.id);
    setOpen(false);
  };

  const { activeIndex, onKeyDown } = useListboxKeyboard({
    open: listOpen,
    itemCount: suggestions.length,
    onSelectIndex: (index) => {
      const c = suggestions[index];
      if (c) selectCustomer(c);
    },
    onClose: () => setOpen(false),
  });

  useEffect(() => {
    if (listOpen) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listOpen]);

  const handleChange = (name: string) => {
    const match = customers.find(
      (c) => c.isActive && c.name.toLowerCase() === name.trim().toLowerCase(),
    );
    onChange(name, match?.id);
  };

  return (
    <Field label="Customer" error={error}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && suggestions.length > 0) {
              e.preventDefault();
              setOpen(true);
            }
            onKeyDown(e);
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={listOpen}
          aria-autocomplete="list"
          aria-controls={listOpen ? listboxId : undefined}
          aria-activedescendant={listOpen ? `${listboxId}-opt-${activeIndex}` : undefined}
        />
        {listOpen && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border-app bg-surface py-1 shadow-lg shadow-black/30"
          >
            {suggestions.map((c, index) => (
              <li key={c.id} role="presentation">
                <button
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={c.id === customerId || index === activeIndex}
                  className={cn(
                    'flex w-full min-h-[48px] items-center justify-between px-3 py-2 text-left text-sm text-foreground active:bg-surface-hover',
                    index === activeIndex && 'bg-surface-hover',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCustomer(c)}
                >
                  <span className="truncate font-medium">{c.name}</span>
                  {c.phone && c.phone !== '-' && (
                    <span className="ml-2 shrink-0 text-xs text-muted">{c.phone}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
