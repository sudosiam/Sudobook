import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { revealContainerVariants, revealVariants } from '@/lib/motion';

/**
 * Fade+rise entrance container — wrap a `page-stack` (or similar) and use
 * `RevealItem` for each direct child to get a staggered mount animation.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={revealContainerVariants}>
      {children}
    </motion.div>
  );
}

/** A single staggered child of `Reveal`. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={revealVariants}>
      {children}
    </motion.div>
  );
}
