"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";

/**
 * The motion kit. Four small pieces, used everywhere, so the whole site moves
 * the same way.
 *
 * Rules the kit enforces so pages cannot get them wrong:
 *  - Movement is a short rise (16px) plus a fade, never a slide across the
 *    screen. Large travel is what makes interfaces feel slow and showy.
 *  - Everything honours prefers-reduced-motion: the content simply appears.
 *  - Scroll reveals fire once. Replaying them on scroll-up is distracting.
 *  - Only opacity and transform are animated, so nothing triggers layout.
 */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Fade + rise when scrolled into view (or on mount with `immediate`). */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  immediate = false,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  /** Animate on mount instead of waiting for scroll — use above the fold. */
  immediate?: boolean;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "header" | "p" | "span";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as ElementType;
  if (reduce) return <Tag className={className}>{children}</Tag>;

  const common = {
    initial: { opacity: 0, y },
    transition: { duration: 0.5, delay, ease: EASE_OUT },
    className,
  };
  return immediate ? (
    <Tag {...common} animate={{ opacity: 1, y: 0 }}>
      {children}
    </Tag>
  ) : (
    <Tag {...common} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -8% 0px" }}>
      {children}
    </Tag>
  );
}

const container = (gap: number, delayChildren: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren } },
});

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** A group whose `StaggerItem` children arrive one after another. */
export function Stagger({
  children,
  className,
  gap = 0.06,
  delay = 0,
  immediate = false,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  immediate?: boolean;
  as?: "div" | "ul" | "ol" | "section" | "dl";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as ElementType;
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      variants={container(gap, delay)}
      initial="hidden"
      {...(immediate
        ? { animate: "show" }
        : { whileInView: "show", viewport: { once: true, margin: "0px 0px -8% 0px" } })}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section" | "dd" | "div";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as ElementType;
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  );
}

/**
 * Counts up to a number the first time it is seen. Numbers that arrive feel
 * earned; numbers that are simply there feel like a spreadsheet. Formats in the
 * Indian grouping (1,00,000) because that is how this audience reads money.
 */
export function CountUp({
  to,
  duration = 900,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic: fast start, gentle landing
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {(reduce ? to : value).toLocaleString("en-IN")}
    </span>
  );
}

/**
 * Wraps a route's content so every page change eases in instead of snapping.
 * Used from a template.tsx, which re-mounts on navigation (a layout does not).
 */
export function PageEnter({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
