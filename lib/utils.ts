import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Used for combining Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fixes the "5 hours ago" issue by forcing UTC parsing
export function timeAgo(dateString: string | null) {
  if (!dateString) return "Just now";

  // Append 'Z' if missing to tell JS this is a UTC time, not local
  const safeDateString = dateString.endsWith("Z") ? dateString : `${dateString}Z`;
  
  const date = new Date(safeDateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + "y ago";

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + "mo ago";

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + "d ago";

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";

  return "Just now";
}

// Formats numbers as Indian Rupees
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}