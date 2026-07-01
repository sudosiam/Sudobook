import { useCallback, useEffect, useRef, useState } from 'react';

export interface DraftEnvelope<T> {
  savedAt: string;
  values: T;
}

const SAVE_DEBOUNCE_MS = 700;
const PREFIX = 'sudobooks:draft:';

function readDraft<T>(storageKey: string): DraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as DraftEnvelope<T>;
  } catch {
    return null;
  }
}

/**
 * Best-effort local draft persistence for long forms (New Sale, New Purchase,
 * New Expense...). Saves are debounced and stored in localStorage — separate
 * from Dexie/the accounting engine, so a half-filled form is never mistaken
 * for a posted transaction. Never throws: storage being full/unavailable
 * just means drafts silently stop working, nothing else breaks.
 */
export function useDraft<T>(key: string, isBlank: (values: T) => boolean) {
  const storageKey = `${PREFIX}${key}`;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasDraft, setHasDraft] = useState(() => readDraft<T>(storageKey) !== null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = useCallback(
    (values: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          if (isBlank(values)) {
            localStorage.removeItem(storageKey);
            setHasDraft(false);
            return;
          }
          const envelope: DraftEnvelope<T> = { savedAt: new Date().toISOString(), values };
          localStorage.setItem(storageKey, JSON.stringify(envelope));
          setHasDraft(true);
        } catch {
          /* storage full/unavailable — drafts are best-effort only */
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [storageKey, isBlank],
  );

  const loadDraft = useCallback((): DraftEnvelope<T> | null => readDraft<T>(storageKey), [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
  }, [storageKey]);

  return { hasDraft, loadDraft, saveDraft, clearDraft };
}
