import { HTMLAttributes, forwardRef } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated";
  padded?: boolean;
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padded = true, className = "", children, ...props }, ref) => {
    const surface = variant === "elevated" ? "bg-[#1A1A24]" : "bg-[#13131A]";
    const padding = padded ? "p-5 md:p-6" : "";
    return (
      <div
        ref={ref}
        className={`${surface} ${padding} border border-white/[0.08] rounded-2xl ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
export default Card;
