import type { WheelEvent } from "react";

/**
 * Stops a focused `<input type="number">` from eating the scroll wheel.
 *
 * A focused number input treats wheel events as increment/decrement. So a user
 * types an amount, scrolls down to reach the next field, and the value silently
 * counts down under the cursor — 100 becomes 99, 98, and with enough scrolling
 * a negative number. From the outside it looks like the field corrupts itself
 * at random, and the wrong price can reach the gig.
 *
 * Blurring on wheel lets the page scroll and leaves the value alone.
 *
 * Attach to EVERY number input: `onWheel={blurOnWheel}`.
 */
export const blurOnWheel = (e: WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};
