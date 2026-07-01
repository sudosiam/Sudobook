import type { Transition, Variants } from 'motion/react';

/**
 * Shared motion presets — keep every sheet/popover/toast/menu animating with the
 * same feel. Prefer these over ad-hoc transition objects in components.
 */

/** Snappy spring — sheets, menus, anything that should feel physically "thrown". */
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };

/** Softer spring — small popovers/dropdowns, subtle scale/position changes. */
export const springSoft: Transition = { type: 'spring', stiffness: 340, damping: 30, mass: 0.8 };

/** CSS fallback easing (ease-out-expo) — use for plain Tailwind transitions. */
export const easePremium = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Full-screen modal (mobile) — fade only, no transform compositing. */
export const fullScreenModalVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** Bottom sheet / modal panel — slides up from below, springs into place. */
export const sheetVariants: Variants = {
  hidden: { y: '100%', opacity: 0.6 },
  visible: { y: 0, opacity: 1, transition: springSnappy },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

/** Centered dialog variant (desktop / sm+ modal). */
export const dialogVariants: Variants = {
  hidden: { scale: 0.94, opacity: 0, y: 8 },
  visible: { scale: 1, opacity: 1, y: 0, transition: springSoft },
  exit: { scale: 0.96, opacity: 0, y: 4, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};

/** Backdrop fade for modals/menus. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Popover / dropdown panel — quick fade + rise, snappier exit. */
export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { ...springSoft, stiffness: 500 } },
  exit: { opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.1 } },
};

/** Toast entrance/exit — slides down from the top, fades out upward. */
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.16 } },
};

/** Fade + rise — page sections, cards, list rows revealing on mount. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: springSoft },
};

/** Container that staggers `revealVariants` children as they mount. */
export const revealContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.055, delayChildren: 0.02 },
  },
};

/** FAB speed-dial menu items — pop in with a slight stagger. */
export const fabItemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.85 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springSnappy },
  exit: { opacity: 0, y: 8, scale: 0.9, transition: { duration: 0.12 } },
};
