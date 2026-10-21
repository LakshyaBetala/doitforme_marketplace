"use client";

import { useState, useRef, useEffect } from "react";
import { compressImage, COMPRESS_PRESETS } from "@/lib/imageCompress";
import VerificationTips from "@/components/VerificationTips";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  ScanLine, 
  UploadCloud, 
  Loader2, 
  ArrowLeft, 
  ShieldCheck, 
  Clock,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

export default function VerifyIDPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "approved" | "review">("idle");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reflect existing state: verified -> profile; under manual review -> review screen;
  // rejected -> let them re-upload and show the reason; otherwise show the uploader.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("kyc_verified, kyc_status, kyc_rejection_reason, id_card_url")
        .eq("id", user.id)
        .single();
      if (data?.kyc_verified || data?.kyc_status === "approved") {
        router.push("/profile");
      } else if (data?.kyc_status === "manual_review") {
        setAlreadySubmitted(true);
      } else if (data?.kyc_status === "rejected" && data?.kyc_rejection_reason) {
        setReason(data.kyc_rejection_reason);
      }
    })();
  }, [supabase, router]);

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    // Backstop for the desktop file picker, where the accept list is a filter
    // and not a guarantee — you can still choose "All files". HEIC is named
    // explicitly because it is the one a phone will hand over by accident, and
    // "please upload an image" would be baffling when the thing you picked IS
    // a photo.
    if (/heic|heif/i.test(selected.type) || /\.(heic|heif)$/i.test(selected.name)) {
      setError(
        "That photo is in Apple's HEIC format, which we can't read. Open it in Photos and share or export it as JPEG, or set Camera → Formats to \"Most Compatible\" and take it again."
      );
      return;
    }
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(selected.type)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) { 
      setError("File size must be less than 5MB");
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError("");
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      // Resize before sending. KYC images were ~1MB each and 75% of all
      // storage; the preset keeps the card legible for the Gemini OCR check.
      const upload = await compressImage(file, COMPRESS_PRESETS.kyc);

      // Upload via server-side API (uses service role key → bypasses Storage RLS)
      const formData = new FormData();
      formData.append("file", upload);

      const res = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed. Try again.");
      }

      if (data.decision === "approved") {
        setStatus("approved");
        setTimeout(() => router.push("/profile"), 2500);
      } else if (data.decision === "rejected") {
        // Stay on the uploader so they can immediately re-shoot a clearer photo.
        setReason(data.reason || "We couldn't confirm this proves you're a student.");
        setFile(null);
        setPreview(null);
      } else {
        // manual_review (incl. fail-open)
        setStatus("review");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };


  if (status === "approved") {
    return (
      <div className="min-h-[70dvh] flex items-center justify-center p-6">
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500 max-w-md">
          <div className="w-24 h-24 bg-[var(--ok-soft)] rounded-full flex items-center justify-center mx-auto border border-[var(--ok-line)] shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="w-12 h-12 text-[var(--ok)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--fg)]">You&apos;re verified ✓</h1>
          <div className="space-y-2 text-[var(--fg-muted)]">
            <p>Your student ID was <strong className="text-[var(--ok)]">approved instantly</strong>.</p>
            <p className="text-sm">The verified badge is now live on your profile. Taking you there…</p>
          </div>
          <Link href="/profile" className="inline-block text-[var(--accent-ink)] hover:text-[var(--fg)] transition-colors font-bold mt-4">
            Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  if (status === "review") {
    return (
      <div className="min-h-[70dvh] flex items-center justify-center p-6">
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500 max-w-md">
          <div className="w-24 h-24 bg-[var(--accent-soft)] rounded-full flex items-center justify-center mx-auto border border-[var(--accent-line)] shadow-[0_0_50px_rgba(136,37,245,0.2)]">
            <Clock className="w-12 h-12 text-[var(--accent-ink)] animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--fg)]">Quick review needed</h1>
          <div className="space-y-2 text-[var(--fg-muted)]">
            <p>Thanks! Your ID needs a <strong>quick human check</strong>.</p>
            <p className="text-sm">This usually takes under a few hours — we&apos;ll email you the moment it&apos;s done.</p>
          </div>
          <Link href="/profile" className="inline-block text-[var(--accent-ink)] hover:text-[var(--fg)] transition-colors font-bold mt-4">
            Return to Profile
          </Link>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-[70dvh] flex items-center justify-center p-6">
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500 max-w-md">
          <div className="w-24 h-24 bg-[var(--warn-soft)] rounded-full flex items-center justify-center mx-auto border border-[var(--warn-line)]">
            <Clock className="w-12 h-12 text-[var(--warn)] animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--fg)]">Under Review</h1>
          <div className="space-y-2 text-[var(--fg-muted)]">
            <p>Your Student ID has already been submitted and is <strong className="text-[var(--warn)]">pending review</strong>.</p>
            <p className="text-sm">Our team will verify it shortly. Approvals typically take 1-12 hours.</p>
          </div>
          <Link href="/profile" className="inline-block text-[var(--accent-ink)] hover:text-[var(--fg)] transition-colors font-bold mt-4">
            Return to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-[var(--fg)]">
      <div className="w-full max-w-xl">
        <Link href="/profile" className="inline-flex items-center gap-2 text-[var(--fg-muted)] hover:text-[var(--fg)] mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>

        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-3xl p-6 md:p-10 relative overflow-hidden">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[var(--accent-soft)] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[var(--accent-line)]">
              <ScanLine className="w-8 h-8 text-[var(--accent-ink)]" />
            </div>
            <h1 className="text-3xl font-black mb-2">Verify you&apos;re a student</h1>
            <p className="text-[var(--fg-muted)]">School, college or university — any student ID works.<br/>Most uploads are approved instantly. JPG or PNG.</p>

            {/* Not everyone has a card. Schools that never issue one, first-years
                whose cards have not been printed, distance learners — students
                wrote in asking what else they could send, and until the
                verifier was broadened the answer was nothing. Saying so here is
                the difference between that fix being usable and invisible. */}
            <div className="mt-5 text-left rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
              <p className="text-[13px] font-semibold text-[var(--fg)] mb-1.5">No student ID card?</p>
              <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
                Any official document naming you and your institution works just as well — a
                bonafide or study certificate, admission letter, fee receipt, recent marksheet,
                or an exam hall ticket.
              </p>
            </div>
          </div>

          {reason && (
            <div className="mb-6 p-4 bg-[var(--warn-soft)] border border-[var(--warn-line)] rounded-2xl text-[var(--warn)] text-sm flex items-start gap-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span><strong>Couldn&apos;t verify your last upload.</strong> {reason} Re-upload a clear, well-lit photo — the front of your ID, or one of the documents listed above.</span>
            </div>
          )}

          {/* Tips BEFORE the upload zone. Shown ahead of the picker because the
              photo is taken in the next three seconds — after the upload it is
              just an explanation of why they failed. */}
          <VerificationTips className="mb-6" />

          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 transition duration-300 min-h-[300px] flex flex-col items-center justify-center ${
              isDragging 
                ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.02]" 
                : preview 
                  ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" 
                  : "border-[var(--line)] hover:border-[var(--accent-line)] hover:bg-[var(--chip-strong)]"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              /*
                Explicit types rather than image/*, because of HEIC.
                iPhones shoot HEIC by default. With accept="image/*" iOS hands
                over the raw .heic; Chrome cannot render it for the preview, and
                the verifier is sent a format the pipeline does not reliably
                handle. Every HEIC upload in the database — 5 of 5 — is sitting
                in manual_review.
                Naming the formats is the fix rather than a warning: iOS
                CONVERTS to JPEG automatically when the accept list excludes
                HEIC, so the student does nothing differently and it just works.
              */
              accept="image/jpeg,image/png,image/webp" 
              className="hidden" 
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />

            {preview ? (
              <div className="relative w-full h-full min-h-[250px] rounded-xl overflow-hidden ">
                <Image src={preview} alt="ID Preview" fill className="object-contain" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--accent-soft)] to-transparent w-full h-[20%] animate-[scan_3s_linear_infinite] border-b border-[var(--accent-line)]"></div>
                <div className="absolute bottom-4 left-0 w-full text-center">
                   <span className="bg-black/70 px-4 py-2 rounded-full text-xs font-bold text-white border border-white/20">Click to change</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 pointer-events-none">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-transform duration-300 ${isDragging ? "bg-[var(--accent)] scale-110" : "bg-[var(--chip-strong)] group-hover:scale-110"}`}>
                  <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? "text-[var(--on-accent)]" : "text-[var(--fg-muted)] group-hover:text-[var(--accent-ink)]"}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--fg)]">
                    {isDragging ? "Drop it here!" : "Click or Drag to Upload"}
                  </p>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">Clear photo of front side (Max 5MB)</p>
                </div>
              </div>
            )}
          </div>

          {error && (
             <div className="mt-6 p-4 bg-[var(--bad-soft)] border border-[var(--bad-line)] rounded-xl text-[var(--bad)] text-sm font-medium flex items-center gap-2 justify-center">
               <AlertCircle className="w-4 h-4" /> {error}
             </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-[var(--accent)] transition-[filter] group-hover:brightness-110"></div>
              <div className="relative rounded-[10px] p-4 flex items-center justify-center gap-3">
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-[var(--on-accent)] animate-spin" />
                    <span className="font-bold text-[var(--on-accent)]">Uploading...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-[var(--on-accent)]" />
                    <span className="font-bold text-[var(--on-accent)]">Submit for Review</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}