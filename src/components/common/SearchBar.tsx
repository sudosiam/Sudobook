import { Search, X } from 'lucide-react';

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
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        enterKeyHint="search"
        className="min-h-[48px] w-full rounded-lg border border-border-app/60 bg-surface py-2 pl-9 pr-10 text-base text-foreground outline-none transition-colors placeholder:text-disabled focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 md:text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted active:bg-surface-hover"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
