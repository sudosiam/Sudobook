import { formatDistanceToNow } from 'date-fns';
import { FileClock } from 'lucide-react';
import { Button } from '@/components/common/Field';

export function DraftBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  let relative = 'earlier';
  try {
    relative = formatDistanceToNow(new Date(savedAt), { addSuffix: true });
  } catch {
    /* keep fallback */
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-3">
      <FileClock className="h-4 w-4 shrink-0 text-brand-light" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Unsaved draft from {relative}</p>
        <p className="text-xs text-muted">Pick up where you left off, or start fresh.</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button type="button" variant="secondary" className="min-h-[36px] px-3 py-1.5 text-xs" onClick={onDiscard}>
          Discard
        </Button>
        <Button type="button" className="min-h-[36px] px-3 py-1.5 text-xs" onClick={onRestore}>
          Restore
        </Button>
      </div>
    </div>
  );
}
