/** Single history stack so Android back dismisses the topmost overlay only. */

const stack: Array<() => void> = [];
let installed = false;

function onPopState(): void {
  const close = stack.pop();
  close?.();
}

function ensureListener(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', onPopState);
}

/** Push a history entry; returns unregister (does not pop history). */
export function registerOverlayHistory(onClose: () => void): () => void {
  ensureListener();
  stack.push(onClose);
  history.pushState({ sudoBooksOverlay: stack.length }, '');

  return () => {
    const idx = stack.lastIndexOf(onClose);
    if (idx >= 0) stack.splice(idx, 1);
  };
}

export function isTopOverlay(onClose: () => void): boolean {
  return stack[stack.length - 1] === onClose;
}

/** Close via UI — sync history when this overlay is on top of the stack. */
export function dismissOverlayHistory(onClose: () => void): boolean {
  if (isTopOverlay(onClose)) {
    history.back();
    return true;
  }
  return false;
}
