import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  fallback: string;
  className?: string;
  textClassName?: string;
  sizes?: string;
}

export default function Avatar({
  src,
  fallback,
  className = "w-8 h-8",
  textClassName = "text-sm",
  sizes = "40px",
}: AvatarProps) {
  const initial = fallback?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center bg-[#1A1A24] ring-1 ring-white/10 text-white font-medium ${className}`}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span className={`${textClassName} tracking-tight`}>{initial}</span>
      )}
    </div>
  );
}
