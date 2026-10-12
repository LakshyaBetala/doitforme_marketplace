"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The accessible dialog primitive. Every overlay in the product should route
 * through this rather than open-coding a `fixed inset-0` div.
 *
 * WHAT WAS WRONG BEFORE THIS FILE. An audit found `role="dialog"`,
 * `aria-modal` and Escape handling appeared ZERO times in the codebase, across
 * roughly eight hand-rolled overlays (the apply sheet on `/gig/[id]`, two on
 * the company task desk, the message lightboxes, the chat scrim). Each one was
 * a `<div onClick={close}>` with an icon-only X button. That produces four
 * separate failures, and the first two are the ones that matter:
 *
 *  1. ESCAPE DID NOTHING. Closing required hitting a 40px X or clicking a
 *     backdrop — the latter being invisible to anyone not using a mouse.
 *  2. FOCUS STAYED BEHIND THE DIALOG. A keyboard or screen-reader user tabbed
 *     straight through the overlay into the page underneath, which is still
 *     rendered and still focusable. The dialog was decoration; the real form
 *     was somewhere off-screen. On the apply sheet that is the screen where
 *     money changes hands.
 *  3. Nothing announced it as a dialog, so a screen reader read the overlay as
 *     more page content with no boundary and no name.
 *  4. The close button was an unlabelled icon — "button" is all it announced.
 *
 * Three deliberate implementation choices:
 *
 * - FOCUS IS RESTORED to whatever was focused before opening. Without it,
 *   closing a dialog drops focus to <body> and the next Tab starts from the
 *   top of the page — so dismissing the apply sheet loses your place on a long
 *   gig listing.
 * - THE BACKDROP COMPARES `e.target === e.currentTarget`. A plain onClick on
 *   the backdrop fires for clicks that bubble out of the panel, so selecting
 *   text in the dialog and releasing the mouse closed it mid-sentence.
 * - `inert` IS NOT USED on the rest of the page. It would be the cleaner
 *   mechanism, but Safari only shipped it in 17.4 and a meaningful share of
 *   this audience is on older iOS, where the attribute is ignored and the trap
 *   silently disappears. The Tab-cycling handler below works everywhere.
 */

/** Everything focusable, minus anything explicitly removed from the tab order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name. Rendered as the heading unless `hideTitle` is set. */
  title: string;
  /** Visually hide the heading but keep it for screen readers (e.g. a lightbox). */
  hideTitle?: boolean;
  children: ReactNode;
  /** Sheet on mobile, centred card from `sm` up. Matches the existing sheets. */
  size?: "sm" | "md" | "lg";
  /** Set false for a destructive confirm, where a stray click should not dismiss. */
  dismissOnBackdrop?: boolean;
  className?: string;
};

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  children,
  size = "md",
  dismissOnBackdrop = true,
  className = "",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Captured on open, restored on close. A ref, not state: changing it must
  // never trigger a render.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      // Only a click that both started and ended on the backdrop itself. See
      // the text-selection note above.
      if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
    },
    [dismissOnBackdrop, onClose],
  );

  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;

    // Move focus INTO the dialog. Prefer the first real control so a form is
    // immediately typeable; fall back to the panel, which carries tabIndex={-1}
    // so it can hold focus without entering the tab order.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      // Cycle Tab within the panel. Re-queried every keypress because the
      // content is dynamic — a dialog that reveals a field on selection would
      // otherwise keep a stale list and skip the new control.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === firstItem || active === panel)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    // Capture phase: a page-level key handler must not see Escape first and
    // act on it while the dialog is the thing the user means to dismiss.
    document.addEventListener("keydown", onKeyDown, true);

    // Scroll lock. `position: fixed` on the body would work too but loses
    // scroll position on close, which is jarring on a long gig listing.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      // Guard against an element that unmounted while the dialog was open.
      const target = returnFocusTo.current;
      if (target && document.body.contains(target)) target.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const titleId = `modal-title-${title.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[var(--background)]/90 backdrop-blur-md p-3 sm:p-4 flex items-end sm:items-center justify-center overscroll-none"
      onClick={onBackdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-[var(--card-elevated)] border border-[var(--card-border)] rounded-3xl w-full ${SIZES[size]} relative p-5 md:p-8 max-h-[90vh] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 outline-none ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="absolute top-4 right-4 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-[var(--card-border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2
          id={titleId}
          className={
            hideTitle
              ? "sr-only"
              : "text-2xl md:text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-2 pr-12"
          }
          style={hideTitle ? undefined : { fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
}

export default Modal;
