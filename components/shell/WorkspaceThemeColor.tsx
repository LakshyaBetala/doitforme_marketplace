"use client";

import { useEffect } from "react";

/**
 * Makes the phone's status bar match the cream workspace.
 *
 * The root layout sets themeColor: "#0B0B11", which is correct everywhere else —
 * the marketing site really is near-black at the top of the page. Inside the
 * workspace the top of the page is cream, so that value paints a black bar above
 * a cream header, which is the most obvious "this is a browser" tell on an
 * installed app.
 *
 * This cannot be a per-colour-scheme <meta>: the right value is decided by the
 * route, not by the OS setting. And it cannot be a second `viewport` export,
 * because a layout's viewport export does not override its parent's themeColor.
 * So it is a small client effect that swaps the tag and puts it back on the way
 * out — which matters, since navigating from the workspace to a public page
 * would otherwise leave the cream bar on a dark page.
 */
const WORKSPACE_THEME = "#fffdf9"; // --w-surface: the top bar, not the page

export default function WorkspaceThemeColor() {
  useEffect(() => {
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    );
    if (metas.length === 0) return;

    const previous = metas.map((m) => ({ el: m, content: m.content, media: m.media }));

    // Next can render several theme-color tags (one per prefers-color-scheme).
    // All of them have to move, or whichever one matches the device wins and the
    // bar stays dark on half of phones.
    for (const m of metas) {
      m.removeAttribute("media");
      m.content = WORKSPACE_THEME;
    }

    return () => {
      for (const { el, content, media } of previous) {
        el.content = content;
        if (media) el.media = media;
        else el.removeAttribute("media");
      }
    };
  }, []);

  return null;
}
