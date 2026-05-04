import Link from "next/link";
import { UserX } from "lucide-react";

export default function UserNotFound() {
  return (
    <div className="min-h-[100dvh] bg-[#0B0B11] text-white flex items-center justify-center px-6">
      <div className="bg-[#13131A] border border-white/[0.08] rounded-2xl px-6 py-12 max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <UserX size={22} className="text-white/40" strokeWidth={1.6} />
        </div>
        <h1 className="text-base font-semibold tracking-tight mb-1">Profile not found</h1>
        <p className="text-sm text-white/50 mb-6">
          No one with that username exists on DoItForMe yet.
        </p>
        <Link
          href="/feed"
          className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[#8825F5] text-white text-sm font-medium tracking-tight hover:bg-[#7a1fe0] transition-colors"
        >
          Browse gigs
        </Link>
      </div>
    </div>
  );
}
