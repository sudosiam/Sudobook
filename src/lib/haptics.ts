/**
 * Tactile feedback via `navigator.vibrate`. No-ops on unsupported browsers and
 * before the first user gesture (Chrome blocks vibrate until then).
 */
let userHasActivated = false;

if (typeof window !== 'undefined') {
  const markActivated = () => {
    userHasActivated = true;
  };
  window.addEventListener('pointerdown', markActivated, { once: true, passive: true });
  window.addEventListener('keydown', markActivated, { once: true });
}

function vibrate(pattern: number | number[]): void {
  if (!userHasActivated) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Blocked outside a user gesture on some browsers — ignore.
  }
}

export const haptics = {
  /** Light tap — menu open/close, picker selection, minor UI toggles. */
  tap: () => vibrate(8),
  /** Slightly firmer tap — primary confirm actions (save, submit). */
  confirm: () => vibrate(12),
  /** Success pattern — paired with success toasts. */
  success: () => vibrate([10, 40, 10]),
  /** Warning/error pattern — paired with error toasts, destructive confirms. */
  warning: () => vibrate([15, 30, 15, 30, 15]),
};
