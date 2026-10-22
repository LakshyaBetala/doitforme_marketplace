/**
 * Opening the floating chat from anywhere.
 *
 * The dock lives in the workspace shell; the buttons that start a chat live on
 * a dozen pages. A window event keeps them decoupled: nothing needs a provider,
 * and a page rendered outside the shell (no dock mounted) gets `false` back and
 * falls back to navigating, so a chat button can never silently do nothing.
 */
export type ChatTarget = {
  gigId?: string;
  otherUserId?: string;
};

export const CHAT_DOCK_EVENT = "dfm:open-chat";

let ready = false;
export function setChatDockReady(value: boolean) {
  ready = value;
}

/** Returns true when the dock took the request. */
export function openChatDock(target: ChatTarget = {}): boolean {
  if (typeof window === "undefined" || !ready) return false;
  window.dispatchEvent(new CustomEvent<ChatTarget>(CHAT_DOCK_EVENT, { detail: target }));
  return true;
}
