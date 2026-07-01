import { Search } from 'lucide-react';

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  'aria-label': ariaLabel = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-disabled" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-h-[48px] w-full rounded-lg border border-border-app/60 bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-disabled focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
      />
    </div>
  );
}
