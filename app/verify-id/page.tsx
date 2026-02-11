"use client";

import { useState, useRef, useEffect } from "react";
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
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState("");
  
  const [isDragging, setIsDragging] = useState(false);

  // Redirect if already verified
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("kyc_verified")
          .eq("id", user.id)
          .single();
        
        if (data?.kyc_verified) router.push("/profile");
      }
    })();
  }, [supabase, router]);

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Please upload an image file (JPG/PNG)");
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      // Using a unique timestamp to prevent caching issues if they re-upload
      const fileName = `${user.id}_student_id_${Date.now()}.${fileExt}`;
      const path = `${user.id}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("kyc-ids") 
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. FIX: Link the uploaded file path to the User Table
      const { error: dbUpdateError } = await supabase
        .from("users")
        .update({ 
          id_card_url: path, // Save the path in the id_card_url column
          updated_at: new Date().toISOString() 
        })
        .eq("id", user.id);

      if (dbUpdateError) throw dbUpdateError;

      setStatus("success");
      setTimeout(() => router.push("/profile"), 3000);

    } catch (err: any) {
      console.error(err);
      if (err.message.includes("new row violates row-level security") || err.message.includes("403")) {
         setError("Upload failed: Permission denied. Please contact admin to fix Storage Policies.");
      } else {
         setError(err.message || "Upload failed. Try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center p-6">
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500 max-w-md">
          <div className="w-24 h-24 bg-brand-purple/10 rounded-full flex items-center justify-center mx-auto border border-brand-purple/20 shadow-[0_0_50px_rgba(136,37,245,0.2)]">
            <Clock className="w-12 h-12 text-brand-purple animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-white">Upload Received</h1>
          <div className="space-y-2 text-white/60">
            <p>Your ID is now <strong>Pending Review</strong>.</p>
            <p className="text-sm">Our team will verify it shortly. Approvals typically take 1-12 hours.</p>
          </div>
          <Link href="/profile" className="inline-block text-brand-purple hover:text-white transition-colors font-bold mt-4">
            Return to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-brand-purple/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="w-full max-w-xl relative z-10">
        <Link href="/profile" className="inline-flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>

        <div className="bg-[#121217] border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-brand-purple/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-purple/20">
              <ScanLine className="w-8 h-8 text-brand-purple" />
            </div>
            <h1 className="text-3xl font-black mb-2">Upload Student ID</h1>
            <p className="text-white/50">Upload your ID card for manual verification.<br/>We support JPG and PNG.</p>
          </div>

          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 transition-all duration-300 min-h-[300px] flex flex-col items-center justify-center ${
              isDragging 
                ? "border-brand-purple bg-brand-purple/10 scale-[1.02]" 
                : preview 
                  ? "border-brand-purple/50 bg-brand-purple/5" 
                  : "border-white/10 hover:border-brand-purple/50 hover:bg-white/5"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />

            {preview ? (
              <div className="relative w-full h-full min-h-[250px] rounded-xl overflow-hidden shadow-lg">
                <Image src={preview} alt="ID Preview" fill className="object-contain" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-purple/20 to-transparent w-full h-[20%] animate-[scan_3s_linear_infinite] border-b border-brand-purple/50"></div>
                <div className="absolute bottom-4 left-0 w-full text-center">
                   <span className="bg-black/70 px-4 py-2 rounded-full text-xs font-bold text-white border border-white/10">Click to change</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 pointer-events-none">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-transform duration-300 ${isDragging ? "bg-brand-purple scale-110" : "bg-white/5 group-hover:scale-110"}`}>
                  <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? "text-white" : "text-white/40 group-hover:text-brand-purple"}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    {isDragging ? "Drop it here!" : "Click or Drag to Upload"}
                  </p>
                  <p className="text-sm text-white/40 mt-1">Clear photo of front side (Max 5MB)</p>
                </div>
              </div>
            )}
          </div>

          {error && (
             <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2 justify-center">
               <AlertCircle className="w-4 h-4" /> {error}
             </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue opacity-100 transition-opacity"></div>
              <div className="relative bg-[#1a1a24] group-hover:bg-transparent transition-colors rounded-[10px] p-4 flex items-center justify-center gap-3">
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                    <span className="font-bold text-white">Uploading...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-white" />
                    <span className="font-bold text-white">Submit for Review</span>
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