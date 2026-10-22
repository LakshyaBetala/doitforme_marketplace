"use client";

import { createContext, useContext } from "react";

const InShellContext = createContext(false);

/**
 * True for a page rendered inside the signed-in workspace shell. A few pages
 * (support, pricing) are public and also reachable from the sidebar, so they
 * have to look right in both places: the dark public site for visitors, the
 * cream workspace for people who are signed in.
 */
export function InShellProvider({ children }: { children: React.ReactNode }) {
  return <InShellContext.Provider value={true}>{children}</InShellContext.Provider>;
}

export const useInShell = () => useContext(InShellContext);
