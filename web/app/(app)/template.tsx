'use client';

import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT_EXPO } from '@/components/motion/primitives';

// Re-mounts on every navigation, so each page gets a directed entrance.
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  // Same element tree in both modes: a structural branch here would make the
  // server and client trees differ under prefers-reduced-motion and shift every useId.
  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.45, ease: EASE_OUT_EXPO }}>
      {children}
    </motion.div>
  );
}
