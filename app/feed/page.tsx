"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function FeedPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadGigs = async () => {
      try {
        setLoading(true);

        const { data, error: fetchError } = await supabase
          .from("gigs")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;

        if (!data || data.length === 0) {
          setGigs([]);
          setImageUrls({});
          return;
        }

        setGigs(data);

        // Preload image URLs
        const urlMap: Record<string, string> = {};

        data.forEach((gig: any) => {
          const firstImg = gig.images?.[0];
          if (firstImg) {
            const { data: publicData } = supabase.storage
              .from("gig-images")
              .getPublicUrl(firstImg);

            urlMap[gig.id] = publicData?.publicUrl || "/placeholder.png";
          } else {
            urlMap[gig.id] = "/placeholder.png";
          }
        });

        setImageUrls(urlMap);
      } catch (err: any) {
        setError(err?.message || "Failed to load gigs");
      } finally {
        setLoading(false);
      }
    };

    loadGigs();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-red-600 font-medium">⚠ {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Browse Gigs</h1>

        {gigs.length === 0 ? (
          <div className="text-center text-gray-500 mt-20 text-lg">
            No gigs posted yet 👀  
            <br />
            <span className="text-purple-600 cursor-pointer" onClick={() => router.push("/post")}>
              Be the first to post!
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig: any) => (
              <div
                key={gig.id}
                onClick={() => router.push(`/gig/${gig.id}`)}
                className="rounded-xl shadow-md p-4 hover:scale-105 transform transition cursor-pointer bg-white"
              >
                <img
                  src={imageUrls[gig.id]}
                  alt={gig.title}
                  className="h-40 w-full object-cover rounded-lg mb-3"
                />

                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{gig.title}</h2>
                  <div className="text-purple-600 font-bold">₹{gig.price}</div>
                </div>

                <div className="text-sm text-gray-500 mb-2">{gig.mode}</div>

                <p className="text-sm text-gray-700 mb-3">
                  {gig.description.length > 80
                    ? gig.description.slice(0, 77) + "..."
                    : gig.description}
                </p>

                <div className="text-xs text-gray-400">{timeAgo(gig.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
