import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, type Theme } from '@/store/useThemeStore';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="flex rounded-xl border border-border-app bg-app p-1">
      {(
        [
          { id: 'dark' as Theme, label: 'Dark', icon: Moon },
          { id: 'light' as Theme, label: 'Light', icon: Sun },
        ] as const
      ).map(({ id, label, icon: Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={cn(
              'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted hover:text-foreground',
            )}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
