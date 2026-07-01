import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

export function useListboxKeyboard({
  open,
  itemCount,
  onSelectIndex,
  onClose,
}: {
  open: boolean;
  itemCount: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open, itemCount]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % itemCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + itemCount) % itemCount);
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelectIndex(activeIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [activeIndex, itemCount, onClose, onSelectIndex, open],
  );

  return { activeIndex, setActiveIndex, onKeyDown };
}
