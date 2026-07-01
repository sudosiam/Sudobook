import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a numeric value counting up/down to `target` whenever it changes.
 * Falls back to an instant snap when the user prefers reduced motion.
 */
export function useCountUp(target: number, durationSeconds = 0.6): number {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  const isFirstRender = useRef(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Snap on the very first mount — only animate subsequent value changes.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevRef.current = target;
      setValue(target);
      return;
    }

    if (reduceMotion || prevRef.current === target) {
      prevRef.current = target;
      setValue(target);
      return;
    }

    const from = prevRef.current;
    prevRef.current = target;
    const controls = animate(from, target, {
      duration: durationSeconds,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });

    return () => controls.stop();
  }, [target, durationSeconds, reduceMotion]);

  return value;
}
