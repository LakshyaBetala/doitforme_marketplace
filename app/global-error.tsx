"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary, for a throw in the ROOT LAYOUT itself.
 *
 * `error.tsx` is rendered *inside* the root layout, so it cannot catch a
 * failure in that layout — the thing that would render the fallback is the
 * thing that broke. This file replaces the document instead, which is why it
 * has to supply its own <html> and <body>.
 *
 * EVERYTHING HERE IS INLINE ON PURPOSE. `app/globals.css` is imported by the
 * root layout, and that layout is exactly what has been replaced, so the CSS
 * variables this codebase styles with (`--background`, `--brand-purple`) and
 * the Space Grotesk/Inter faces are all unavailable. Tailwind classes would
 * render as unstyled markup — white text on a white page. The colours below
 * are therefore the literal values of the tokens, and they are the one place
 * in the app where hardcoding them is correct rather than a design-system
 * violation.
 *
 * There is no "try again" here. `reset()` re-renders the root layout, which is
 * the component that just threw, so the realistic exit is a fresh document
 * request to a known-good route.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "no-digest", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 1.25rem",
          backgroundColor: "#0B0B11",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#C9A9FF",
              margin: "0 0 0.75rem",
            }}
          >
            Something broke
          </p>

          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 0.75rem",
            }}
          >
            doitforme is having a moment
          </h1>

          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.65,
              color: "rgba(250,250,250,0.62)",
              margin: "0 0 2rem",
            }}
          >
            The problem is on our side. Nothing you were doing was lost — any
            money held in escrow stays held until you approve it.
          </p>

          {/*
            A plain <a>, not next/link, and the lint rule is disabled rather
            than satisfied. Link does a CLIENT-SIDE navigation, which re-mounts
            the same root layout that just threw — it would land the visitor
            straight back on this screen. Only a fresh document request
            rebuilds the layout, so the full page load is the fix here.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.75rem",
              backgroundColor: "#8825F5",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Reload doitforme
          </a>

          {error.digest ? (
            <p
              style={{
                marginTop: "2rem",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                color: "rgba(250,250,250,0.62)",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
