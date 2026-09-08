'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react';

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

/** Fade/rise reveal, once, when scrolled into view. Static under reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
  ...rest
}: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' | 'article' } & Omit<
  HTMLMotionProps<'div'>,
  'children'
>) {
  const reduced = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  // Same tree in both modes (reduced motion only removes the animation) so SSR and
  // client hydration agree and useId-based ids stay stable.
  return (
    <Comp
      className={className}
      variants={revealVariants}
      initial={reduced ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Staggers direct Reveal-like children (use with `Stagger.Item`). */
export function Stagger({
  children,
  className,
  stagger = 0.06,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={revealVariants} transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}>
      {children}
    </motion.div>
  );
}

/** Animated number that rolls up when in view. Renders the final value under reduced motion. */
export function Counter({
  value,
  duration = 1.4,
  format = (n) => Math.round(n).toLocaleString('en-IN'),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  // `format` is usually an inline function (new identity every render); read it
  // through a ref so the effect below depends only on real inputs.
  const formatRef = useRef(format);
  formatRef.current = format;
  const [display, setDisplay] = useState(() => format(reduced ? value : 0));

  useEffect(() => {
    if (reduced) {
      setDisplay(formatRef.current(value));
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => setDisplay(formatRef.current(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduced, mv]);

  return (
    <span ref={ref} className={`tabular ${className ?? ''}`}>
      {display}
    </span>
  );
}

/** Streaming/skeleton shimmer bar. Static muted bar under reduced motion. */
export function Shimmer({ className = 'h-4 w-full' }: { className?: string }) {
  const reduced = useReducedMotion();
  return <div aria-hidden className={`rounded-md ${reduced ? 'bg-muted' : 'shimmer'} ${className}`} />;
}

/** Splits text into words that rise in sequence. Public surfaces only. */
export function SplitWords({
  text,
  className,
  delay = 0,
  as: Tag = 'h1',
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'p' | 'span';
}) {
  const reduced = useReducedMotion();
  const words = text.split(' ');
  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduced ? false : { y: '110%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.9, ease: EASE_OUT_EXPO, delay: reduced ? 0 : delay + i * 0.045 }}
            aria-hidden
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}

/** Button/card wrapper that leans toward the cursor. Public surfaces only. */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y }}
      onMouseMove={(e) => {
        if (reduced) return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Infinite horizontal marquee. Duplicates children for a seamless loop; paused under reduced motion. */
export function Marquee({ children, className, duration = 40 }: { children: ReactNode; className?: string; duration?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className={`relative flex overflow-hidden ${className ?? ''}`} style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
      <div
        className={`flex shrink-0 items-center gap-3 pr-3 ${reduced ? '' : 'animate-marquee'}`}
        style={{ ['--marquee-duration' as string]: `${duration}s` }}
      >
        {children}
        {!reduced && <span aria-hidden className="contents">{children}</span>}
      </div>
    </div>
  );
}

/** Press feedback for tappable cards. */
export const pressable = {
  whileTap: { scale: 0.985 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 28 },
};
