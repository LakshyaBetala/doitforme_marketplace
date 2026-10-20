"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

/** Routes that are a list + detail layout and need the whole viewport. */
export const IMMERSIVE_ROUTES = ["/messages", "/chat"];
export const isImmersive = (pathname: string) =>
  IMMERSIVE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * The page area. Two modes:
 *
 *  - normal: padded, centred, max 1180px, and each navigation eases in.
 *  - immersive (messages): edge to edge, exactly the viewport tall, no top bar.
 *    A chat is a tool, not a document — padding around it only shrinks the
 *    part you type in, and a second header above its own header is clutter.
 */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (isImmersive(pathname)) {
    return (
      <main className="min-w-0 flex-1 overflow-hidden h-[calc(100dvh-62px-60px-env(safe-area-inset-bottom))] lg:h-[100dvh]">
        {children}
      </main>
    );
  }

  return (
    // Bottom padding clears the mobile bar; lg drops it since the bar is gone.
    <main className="min-w-0 flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">
      <motion.div
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="mx-auto w-full max-w-[1180px]"
      >
        {children}
      </motion.div>
    </main>
  );
}
