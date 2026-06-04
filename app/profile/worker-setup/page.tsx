"use client";

import { useState, useRef, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Upload, Plus, X, Briefcase, Link as LinkIcon, Star, CheckCircle, FileText, ExternalLink, Sparkles, Shield, AlertTriangle } from "lucide-react";

export default function WorkerSetupPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const [skills, setSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState("");

    const [portfolioLinks, setPortfolioLinks] = useState<string[]>([]);
    const [linkInput, setLinkInput] = useState("");

    const [experience, setExperience] = useState("");
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [existingResumeUrl, setExistingResumeUrl] = useState<string | null>(null);

    const [phone, setPhone] = useState("");
    const [upiId, setUpiId] = useState("");

    const [fromApply, setFromApply] = useState(false);
    const [redirectGigId, setRedirectGigId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('from') === 'apply') setFromApply(true);
            setRedirectGigId(params.get('gigId'));
        }
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }
            const { data, error } = await supabase
                .from('users')
                .select('skills, portfolio_links, experience, resume_url, phone, upi_id')
                .eq('id', user.id)
                .single();
            
            if (data) {
                setSkills(data.skills || []);
                setPortfolioLinks(data.portfolio_links || []);
                setExperience(data.experience || "");
                setExistingResumeUrl(data.resume_url || null);
                setPhone(data.phone ? String(data.phone) : "");
                setUpiId(data.upi_id || "");
            }
            setFetching(false);
        };
        fetchProfile();
    }, [router, supabase]);

    const handleAddSkill = () => {
        if (skillInput.trim() && skills.length < 3) {
            setSkills([...skills, skillInput.trim()]);
            setSkillInput("");
        }
    };

    const handleRemoveSkill = (index: number) => {
        setSkills(skills.filter((_, i) => i !== index));
    };

    const handleAddLink = () => {
        if (linkInput.trim() && portfolioLinks.length < 3) {
            setPortfolioLinks([...portfolioLinks, linkInput.trim()]);
            setLinkInput("");
        }
    };

    const handleRemoveLink = (index: number) => {
        setPortfolioLinks(portfolioLinks.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        setLoading(true);

        if (fromApply) {
            if (!phone.trim()) { setLoading(false); return setError("Phone number is required to apply."); }
            if (!upiId.trim()) { setLoading(false); return setError("UPI ID is required to apply."); }
            if (skills.length === 0 && !existingResumeUrl && !resumeFile) {
                setLoading(false);
                return setError("You must add at least one skill or upload a resume.");
            }
        }

        if (upiId.trim()) {
            const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
            if (!upiRegex.test(upiId.trim())) {
                setLoading(false);
                return setError("Invalid UPI ID format. (e.g., name@oksbi)");
            }
        }

        if (resumeFile && resumeFile.size > 2 * 1024 * 1024) {
            setLoading(false);
            return setError("Resume must be less than 2MB.");
        }

        try {
            // Upload the resume straight from the browser to Supabase Storage rather
            // than POSTing a multipart file through the serverless function — that
            // path was dropping on mobile and surfacing as "Failed to fetch".
            let resumeUrl: string | null = existingResumeUrl;
            if (resumeFile) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return setError("Your session expired. Please log in again.");
                }
                const ext = resumeFile.name.split('.').pop()?.toLowerCase() || 'pdf';
                const path = `${user.id}/resume_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("resumes")
                    .upload(path, resumeFile, {
                        upsert: true,
                        cacheControl: "3600",
                        contentType: resumeFile.type || undefined,
                    });
                if (uploadError) {
                    setLoading(false);
                    return setError(`Resume upload failed: ${uploadError.message}`);
                }
                resumeUrl = supabase.storage.from("resumes").getPublicUrl(path).data.publicUrl;
            }

            const res = await fetch("/api/profile/worker-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    skills,
                    portfolio_links: portfolioLinks,
                    experience,
                    phone: phone.trim(),
                    upi_id: upiId.trim(),
                    resume_url: resumeUrl || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to save profile.");
            } else {
                setSuccess(true);
                setTimeout(() => {
                    if (fromApply && redirectGigId) {
                        router.push(`/gig/${redirectGigId}`);
                    } else {
                        router.push("/profile");
                    }
                }, 2000);
            }
        } catch (err: any) {
            setError(err.message || "Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Profile completeness
    const completionItems = [
        { label: "Phone", done: !!phone.trim() },
        { label: "UPI ID", done: !!upiId.trim() },
        { label: "Skills", done: skills.length > 0 },
        { label: "Portfolio", done: portfolioLinks.length > 0 },
        { label: "Resume", done: !!(existingResumeUrl || resumeFile) },
        { label: "Experience", done: !!experience.trim() },
    ];
    const completionCount = completionItems.filter(i => i.done).length;
    const completionPct = Math.round((completionCount / completionItems.length) * 100);

    // Extract resume filename from URL
    const resumeFilename = existingResumeUrl 
        ? decodeURIComponent(existingResumeUrl.split('/').pop()?.split('?')[0] || 'resume')
        : null;

    const inputStyle = "w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base placeholder:text-white/50 focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all appearance-none";
    const labelStyle = "block text-sm font-bold text-white/80 mb-2";
    const sectionCardStyle = "bg-[#121217]/80 border border-white/[0.06] rounded-2xl p-5 md:p-6";

    if (fetching) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#8825F5]" /></div>;

    return (
        <div className="min-h-[100dvh] bg-[#0B0B11] text-white p-4 md:p-8 pb-24">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={20} /> Back
                </button>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8825F5] to-[#C9A9FF] flex items-center justify-center shadow-lg shadow-[#8825F5]/20">
                            <Briefcase className="text-white" size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Worker Profile</h1>
                            <p className="text-white/40 text-sm">Stand out to companies & posters</p>
                        </div>
                    </div>
                </div>

                {/* Apply Required Banner */}
                {fromApply && (
                    <div className="mb-8 relative overflow-hidden bg-gradient-to-r from-red-500/10 via-[#8825F5]/10 to-blue-500/10 border-2 border-red-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(255,0,0,0.1)] animate-in fade-in slide-in-from-top-4">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
                        <div className="flex items-start md:items-center gap-5 relative z-10">
                            <div className="p-3 bg-red-500/20 rounded-2xl shrink-0 shadow-inner">
                                <AlertTriangle size={28} className="text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2 uppercase text-red-100">Action Required to Apply</h2>
                                <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium">
                                    You cannot apply for tasks until you provide the following details below: <br className="hidden md:block"/>
                                    <span className="text-amber-400 font-bold">1. Phone Number</span> (for Direct Connect) &nbsp;•&nbsp; 
                                    <span className="text-amber-400 font-bold">2. UPI ID</span> (for Escrow Payouts) &nbsp;•&nbsp; 
                                    <span className="text-[#C9A9FF] font-bold">3. Skills or Resume</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Completeness Bar */}
                <div className={`${sectionCardStyle} mb-6`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className={completionPct === 100 ? "text-green-400" : "text-[#C9A9FF]"} />
                            <span className="text-xs font-bold uppercase tracking-widest text-white/60">Profile Strength</span>
                        </div>
                        <span className={`text-sm font-black ${completionPct === 100 ? 'text-green-400' : completionPct >= 50 ? 'text-[#C9A9FF]' : 'text-amber-400'}`}>
                            {completionPct}%
                        </span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                        <div 
                            className={`h-full rounded-full transition-all duration-700 ${completionPct === 100 ? 'bg-green-500' : completionPct >= 50 ? 'bg-[#8825F5]' : 'bg-amber-500'}`}
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {completionItems.map(item => (
                            <span key={item.label} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${item.done ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                {item.done ? <CheckCircle size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-current" />}
                                {item.label}
                            </span>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    
                    {/* Basic Info */}
                    <div className={sectionCardStyle}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>Phone Number {fromApply && <span className="text-amber-400">*</span>}</label>
                                <input
                                    type="tel"
                                    placeholder="Required for direct connect tasks"
                                    className={inputStyle}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>UPI ID {fromApply && <span className="text-amber-400">*</span>}</label>
                                <input
                                    type="text"
                                    placeholder="name@bank (Required for payouts)"
                                    className={inputStyle}
                                    value={upiId}
                                    onChange={(e) => setUpiId(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Skills */}
                    <div className={sectionCardStyle}>
                        <label className={labelStyle}>
                            Top Skills <span className="text-white/40 font-normal">(Max 3)</span>
                        </label>
                        <p className="text-xs text-white/40 mb-3">Highlight your best skills to increase your chances of getting hired.</p>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="e.g. React.js, Video Editing, Python"
                                className={inputStyle}
                                value={skillInput}
                                onChange={(e) => setSkillInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddSkill();
                                    }
                                }}
                                disabled={skills.length >= 3}
                            />
                            <button
                                type="button"
                                onClick={handleAddSkill}
                                disabled={skills.length >= 3 || !skillInput.trim()}
                                className="px-6 rounded-xl bg-[#8825F5] text-white font-bold hover:bg-[#7D5FFF] disabled:opacity-50 transition-colors shrink-0"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {skills.map((skill, index) => (
                                <div key={index} className="flex items-center gap-2 bg-[#8825F5]/20 text-[#C9A9FF] px-3 py-1.5 rounded-full text-sm font-medium border border-[#8825F5]/30">
                                    {skill}
                                    <button type="button" onClick={() => handleRemoveSkill(index)} className="hover:text-white transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {skills.length === 0 && (
                                <span className="text-xs text-white/30 italic">No skills added yet</span>
                            )}
                        </div>
                    </div>

                    {/* Portfolio Links */}
                    <div className={sectionCardStyle}>
                        <label className={labelStyle}>
                            Portfolio / Project Links <span className="text-white/40 font-normal">(Max 3)</span>
                        </label>
                        <p className="text-xs text-white/40 mb-3">GitHub, Behance, Dribbble, personal websites — anything that showcases your work.</p>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="url"
                                placeholder="https://github.com/... or any link"
                                className={inputStyle}
                                value={linkInput}
                                onChange={(e) => setLinkInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddLink();
                                    }
                                }}
                                disabled={portfolioLinks.length >= 3}
                            />
                            <button
                                type="button"
                                onClick={handleAddLink}
                                disabled={portfolioLinks.length >= 3 || !linkInput.trim()}
                                className="px-6 rounded-xl bg-[#0097FF] text-white font-bold hover:bg-[#007FCC] disabled:opacity-50 transition-colors shrink-0"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 mt-3">
                            {portfolioLinks.map((link, index) => (
                                <div key={index} className="flex items-center justify-between bg-[#1A1A24] p-3 rounded-xl border border-white/5 group hover:border-[#0097FF]/30 transition-colors">
                                    <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 truncate flex-1 min-w-0">
                                        <LinkIcon size={16} className="text-[#0097FF] shrink-0" />
                                        <span className="text-sm text-white/80 truncate group-hover:text-[#0097FF] transition-colors">{link}</span>
                                        <ExternalLink size={12} className="text-white/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                    <button type="button" onClick={() => handleRemoveLink(index)} className="text-white/40 hover:text-red-400 p-1 ml-2 shrink-0">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                            {portfolioLinks.length === 0 && (
                                <span className="text-xs text-white/30 italic">No portfolio links added yet</span>
                            )}
                        </div>
                    </div>

                    {/* Experience */}
                    <div className={sectionCardStyle}>
                        <label className={labelStyle}>Experience / About</label>
                        <textarea
                            rows={4}
                            placeholder="Briefly describe your relevant experience, degrees, or certifications..."
                            className={`${inputStyle} resize-none`}
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                        />
                    </div>

                    {/* Resume Upload */}
                    <div className={sectionCardStyle}>
                        <label className={labelStyle}>Resume (PDF/Image)</label>
                        
                        {/* Show current resume if exists */}
                        {existingResumeUrl && !resumeFile && (
                            <div className="mb-4 flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl p-4 animate-in fade-in duration-300">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                                        <FileText size={18} className="text-green-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-green-400 flex items-center gap-2">
                                            <CheckCircle size={12} /> Resume Uploaded
                                        </p>
                                        <p className="text-xs text-green-400/60 truncate">{resumeFilename}</p>
                                    </div>
                                </div>
                                <a
                                    href={existingResumeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/20 transition-colors shrink-0 ml-3"
                                >
                                    View
                                </a>
                            </div>
                        )}
                        
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full border-2 border-dashed border-white/20 hover:border-[#8825F5]/50 bg-[#0B0B11] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-[#8825F5]/10 flex items-center justify-center mb-3 transition-colors">
                                <Upload className="text-white/50 group-hover:text-[#8825F5]" size={24} />
                            </div>
                            <p className="text-white/80 font-medium mb-1">
                                {resumeFile ? resumeFile.name : (existingResumeUrl ? "Upload a new resume" : "Click to upload resume")}
                            </p>
                            <p className="text-white/40 text-xs">
                                {resumeFile ? "Click to change file" : "Max 2MB (PDF or Image)"}
                            </p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pdf,image/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setResumeFile(e.target.files[0]);
                                    }
                                }}
                            />
                        </div>

                        {resumeFile && (
                            <div className="mt-3 flex items-center gap-3 bg-[#8825F5]/10 border border-[#8825F5]/20 rounded-xl p-3 animate-in fade-in duration-300">
                                <FileText size={16} className="text-[#C9A9FF] shrink-0" />
                                <span className="text-sm text-[#C9A9FF] truncate flex-1">{resumeFile.name}</span>
                                <button type="button" onClick={() => { setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-white/40 hover:text-red-400 p-1">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Info Card */}
                    <div className="bg-[#8825F5]/5 border border-[#8825F5]/10 rounded-2xl p-4 flex items-start gap-3">
                        <Shield size={16} className="text-[#C9A9FF] shrink-0 mt-0.5" />
                        <p className="text-xs text-white/50 leading-relaxed">
                            <span className="text-[#C9A9FF] font-bold">Companies see your profile.</span> Your skills, portfolio, and resume are visible to companies when you apply. A complete profile significantly increases your chances.
                        </p>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="p-4 rounded-xl text-sm border bg-red-500/10 border-red-500/20 text-red-400 animate-in zoom-in-95">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-4 rounded-xl text-sm border bg-green-500/10 border-green-500/20 text-green-400 flex items-center justify-center gap-2 animate-in zoom-in-95">
                            <CheckCircle size={18} /> Profile updated successfully! Redirecting...
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#8825F5] to-[#7D5FFF] hover:opacity-90 text-white p-4 rounded-xl disabled:opacity-50 font-bold shadow-[0_0_20px_rgba(136,37,245,0.3)] flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Save Profile"}
                    </button>
                </form>
            </div>
        </div>
    );
}
