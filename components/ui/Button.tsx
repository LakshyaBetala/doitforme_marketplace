import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * One primary per surface. Everything else is a subtle fill with a hairline.
 *
 * Token-based so the same button is correct on dark and cream. Two details that
 * matter more than they look:
 *
 * 1. `primary` keeps its label on --on-accent (white in both palettes) rather
 *    than --fg. A blanket text-white -> text-[var(--fg)] sweep would make the
 *    label dark violet on a violet fill — the invisible-button bug.
 * 2. The hover is a brightness step, not a second hardcoded purple. The old
 *    hover:bg-[#7a1fe0] was a darker shade of the DARK theme's purple, so on
 *    cream the button jumped hue on hover. Brightness works off whatever
 *    --accent currently is.
 */
type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--accent-line)]",
  secondary:
    "bg-[var(--chip)] text-[var(--fg)] hover:bg-[var(--chip-strong)] border border-[var(--line)] focus-visible:ring-2 focus-visible:ring-[var(--line-strong)]",
  ghost:
    "bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--chip)] focus-visible:ring-2 focus-visible:ring-[var(--line)]",
  destructive:
    "bg-[var(--bad-soft)] text-[var(--bad)] hover:brightness-95 border border-[var(--bad-line)] focus-visible:ring-2 focus-visible:ring-[var(--bad-line)]",
};

const SIZES: Record<Size, string> = {
  // Heights are >= 44px from md up: that is the minimum reliable touch target,
  // and these are the sizes used on phones.
  sm: "h-10 px-3.5 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  lg: "h-14 px-7 text-[16px] gap-2.5 rounded-[14px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-bold tracking-tight transition-[background-color,filter,transform,box-shadow,border-color] duration-150 ease-[var(--ease-out)] outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] ${
          fullWidth ? "w-full" : ""
        } ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
