import { HTMLAttributes, forwardRef } from "react";

/**
 * The one card surface. Depth comes from the surface scale and a hairline, not
 * from a shadow.
 *
 * Written against the shared token contract (see the end of app/globals.css) so
 * the same component is correct on the dark marketing pages and on the cream
 * workspace. It used to hardcode bg-[#13131A] + border-white/[0.08], which made
 * it unusable inside .workspace without a fork.
 */
type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated";
  padded?: boolean;
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padded = true, className = "", children, ...props }, ref) => {
    const surface = variant === "elevated" ? "bg-[var(--surface-2)]" : "bg-[var(--surface)]";
    const padding = padded ? "p-5 md:p-6" : "";
    return (
      <div
        ref={ref}
        className={`${surface} ${padding} border border-[var(--line)] rounded-2xl ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
export default Card;
