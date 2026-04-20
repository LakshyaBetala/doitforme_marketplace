"use client";

import { useState, useRef, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Upload, Plus, X, Briefcase, Link as LinkIcon, Star, CheckCircle } from "lucide-react";

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

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }
            const { data, error } = await supabase
                .from('users')
                .select('skills, portfolio_links, experience, resume_url')
                .eq('id', user.id)
                .single();
            
            if (data) {
                setSkills(data.skills || []);
                setPortfolioLinks(data.portfolio_links || []);
                setExperience(data.experience || "");
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

        const formData = new FormData();
        formData.append("skills", JSON.stringify(skills));
        formData.append("portfolio_links", JSON.stringify(portfolioLinks));
        formData.append("experience", experience);
        if (resumeFile) {
            if (resumeFile.size > 2 * 1024 * 1024) {
                setLoading(false);
                return setError("Resume must be less than 2MB.");
            }
            formData.append("resume", resumeFile);
        }

        try {
            const res = await fetch("/api/profile/worker-setup", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to save profile.");
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push("/profile");
                }, 2000);
            }
        } catch (err: any) {
            setError(err.message || "Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = "w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base placeholder:text-white/50 focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all appearance-none";
    const labelStyle = "block text-sm font-bold text-white/80 mb-2";

    if (fetching) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#8825F5]" /></div>;

    return (
        <div className="min-h-[100dvh] bg-[#0B0B11] text-white p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={20} /> Back to Profile
                </button>

                <div className="bg-[#121217]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
                    <h1 className="text-2xl md:text-3xl font-black mb-2 flex items-center gap-2">
                        <Briefcase className="text-[#8825F5]" /> Worker Profile
                    </h1>
                    <p className="text-white/50 text-sm mb-8">
                        Enhance your profile to stand out to companies and posters. Posters will review this before accepting your applications.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Skills */}
                        <div>
                            <label className={labelStyle}>Top Skills (Max 3)</label>
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
                                    className="px-6 rounded-xl bg-[#8825F5] text-white font-bold hover:bg-[#7D5FFF] disabled:opacity-50 transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {skills.map((skill, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-[#8825F5]/20 text-[#8825F5] px-3 py-1.5 rounded-full text-sm font-medium border border-[#8825F5]/30">
                                        {skill}
                                        <button type="button" onClick={() => handleRemoveSkill(index)} className="hover:text-white transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-white/40 mt-2">Highlight your best skills to increase your chances.</p>
                        </div>

                        {/* Portfolio Links */}
                        <div>
                            <label className={labelStyle}>Portfolio / Gig Links (Max 3)</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="url"
                                    placeholder="https://github.com/..."
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
                                    className="px-6 rounded-xl bg-[#0097FF] text-white font-bold hover:bg-[#007FCC] disabled:opacity-50 transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-col gap-2 mt-3">
                                {portfolioLinks.map((link, index) => (
                                    <div key={index} className="flex items-center justify-between bg-[#1A1A24] p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3 truncate">
                                            <LinkIcon size={16} className="text-[#0097FF] shrink-0" />
                                            <span className="text-sm text-white/80 truncate">{link}</span>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveLink(index)} className="text-white/40 hover:text-red-400 p-1">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Experience */}
                        <div>
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
                        <div>
                            <label className={labelStyle}>Resume (PDF/Image)</label>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-white/20 hover:border-[#8825F5]/50 bg-[#0B0B11] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-[#8825F5]/10 flex items-center justify-center mb-3 transition-colors">
                                    <Upload className="text-white/50 group-hover:text-[#8825F5]" size={24} />
                                </div>
                                <p className="text-white/80 font-medium mb-1">
                                    {resumeFile ? resumeFile.name : "Click to upload resume"}
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
        </div>
    );
}
