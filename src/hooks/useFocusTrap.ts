import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const FOCUS_TRAP_ALLOW = 'data-focus-trap-allow';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  );
}

function isInTrapScope(el: Element | null, panel: HTMLElement): boolean {
  if (!el) return false;
  if (panel.contains(el)) return true;
  return !!el.closest(`[${FOCUS_TRAP_ALLOW}]`);
}

function getTrapFocusables(panel: HTMLElement): HTMLElement[] {
  const inPanel = getFocusableElements(panel);
  const portals = [...document.querySelectorAll<HTMLElement>(`[${FOCUS_TRAP_ALLOW}]`)];
  const inPortals = portals.flatMap((el) => getFocusableElements(el));
  return [...inPanel, ...inPortals];
}

/** Trap focus inside `containerRef` while `active`; restores focus on deactivate. */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = containerRef.current;
    const focusables = panel ? getFocusableElements(panel) : [];
    focusables[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        if (isInTrapScope(document.activeElement, panel!)) return;
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      if (!isInTrapScope(document.activeElement, panel)) return;
      const items = getTrapFocusables(panel);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [active, containerRef, onEscape]);
}
