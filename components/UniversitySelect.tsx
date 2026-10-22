"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, Building2, MapPin } from "lucide-react";

// Helper type for grouping
type CollegeGroup = {
    label: string;
    items: string[];
};

export const COLLEGES: string[] = [
    "Amity University",
    "Anna University (CEG/MIT/ACT)",
    "Ashoka University",
    "Banaras Hindu University (BHU)",
    "BITS Goa",
    "BITS Hyderabad",
    "BITS Pilani",
    "BS Abdur Rahman Crescent Institute",
    "Christ University, Bangalore",
    "Coimbatore Institute of Technology",
    "DG Vaishnav College",
    "Delhi University (DU)",
    "Ethiraj College for Women",
    "Hindustan Institute of Technology and Science",
    "IIIT Bangalore",
    "IIIT Delhi",
    "IIIT Hyderabad",
    "IIT Bombay",
    "IIT Delhi",
    "IIT Guwahati",
    "IIT Kanpur",
    "IIT Kharagpur",
    "IIT Madras",
    "IIT Roorkee",
    "Jadavpur University",
    "Jamia Millia Islamia",
    "Jawaharlal Nehru University (JNU)",
    "Kumaraguru College of Technology",
    "Loyola College",
    "Madras Christian College (MCC)",
    "Madras Institute of Technology (MIT)",
    "Manipal Academy of Higher Education (MAHE)",
    "Meenakshi College for Women",
    "MOP Vaishnav College for Women",
    "National Law School of India University (NLSIU)",
    "NIT Calicut",
    "NIT Rourkela",
    "NIT Surathkal",
    "NIT Trichy",
    "NIT Warangal",
    "NMIMS Mumbai",
    "Presidency College, Chennai",
    "PSG College of Technology",
    "Rajalakshmi Engineering College",
    "Ramakrishna Mission Vivekananda College",
    "SASTRA Deemed University",
    "Sathyabama Institute of Science and Technology",
    "Saveetha University",
    "SRM University (AP)",
    "SRM University (Kattankulathur)",
    "SRM University (Ramapuram)",
    "SRM University (Vadapalani)",
    "SSN College of Engineering",
    "Stella Maris College",
    "Symbiosis International (Pune)",
    "Thapar Institute of Engineering and Technology",
    "Vels University",
    "VIT Chennai",
    "VIT Vellore",
    "Women's Christian College (WCC)",
    "Other"
];

interface Props {
    value: string;
    onChange: (val: string) => void;
    /** The caller already renders its own label above the field. */
    hideLabel?: boolean;
    /** Same height and type size as a plain text input in a dense form. */
    compact?: boolean;
}

// Colours come from the semantic tokens, not literals, so the one component
// reads correctly on the dark sign-in pages and on the cream workspace. It had
// near-black literals and rendered as a black slab inside the profile form.
export default function UniversitySelect({ value, onChange, hideLabel = false, compact = false }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter and maintain order
    const filteredColleges = useMemo(() => {
        return COLLEGES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    }, [search]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {!hideLabel && (
                <label className="block text-[10px] font-bold text-[var(--fg-muted)] mb-2 ml-1 uppercase tracking-wider">
                    School / College / University
                </label>
            )}

            {/* TRIGGER BUTTON */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full ${compact ? "p-3 text-sm" : "p-4 text-base"} rounded-xl bg-[var(--chip)] border border-[var(--line)] text-[var(--fg)] flex justify-between items-center cursor-pointer hover:border-[var(--accent-line)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-soft)] transition group text-left`}
            >
                <div className="flex items-center gap-3 pr-4 flex-1 overflow-hidden">
                    <Building2 size={18} className="text-[var(--fg-faint)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                    <span className={`line-clamp-2 text-left leading-tight ${value ? "text-[var(--fg)] font-medium" : "text-[var(--fg-faint)]"}`}>
                        {value || "Search your school, college or university…"}
                    </span>
                </div>
                <ChevronDown size={18} className={`text-[var(--fg-faint)] transition-transform shrink-0 ${isOpen ? "rotate-180 text-[var(--accent)]" : ""}`} />
            </button>

            {/* DROPDOWN MENU */}
            {isOpen && (
                <div
                    className="absolute z-[9999] w-full mt-2 bg-[var(--surface)] border border-[var(--line-strong)] rounded-2xl shadow-[0_18px_50px_-12px_rgba(30,10,50,0.45)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    onKeyDown={handleKeyDown}
                >
                    {/* SEARCH BOX */}
                    <div className="p-3 border-b border-[var(--line)] flex items-center gap-3 bg-[var(--chip)] sticky top-0 z-10">
                        <Search size={18} className="text-[var(--fg-faint)] ml-1" />
                        <input
                            type="text"
                            placeholder="Type to search…"
                            className="bg-transparent border-none outline-none text-[var(--fg)] text-base w-full font-sans placeholder:text-[var(--fg-faint)]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* LIST ITEMS */}
                    <div className="overflow-y-auto max-h-[280px] w-full custom-scrollbar p-2 scroll-smooth">
                        {filteredColleges.length > 0 ? (
                            <div className="space-y-1">
                                {/* Visual indicator for top/priority colleges if no search is active */}
                                {!search && (
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-[var(--fg-faint)] uppercase tracking-widest flex items-center gap-2">
                                        <MapPin size={12} className="text-[var(--accent)]" /> Top Campuses
                                    </div>
                                )}

                                {filteredColleges.map((col, index) => {
                                    // Add a separator before "Other"
                                    const isOther = col === "Other";

                                    return (
                                        <div key={col}>
                                            {isOther && <div className="h-px bg-[var(--line)] my-2 mx-2"></div>}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onChange(col);
                                                    setIsOpen(false);
                                                    setSearch("");
                                                }}
                                                className={`w-full text-left px-4 py-3 rounded-xl text-sm md:text-base cursor-pointer flex items-center justify-between transition group ${value === col
                                                    ? 'bg-[var(--accent-soft)] text-[var(--fg)] font-bold border border-[var(--accent-line)]'
                                                    : 'text-[var(--fg-muted)] hover:bg-[var(--chip)] hover:text-[var(--fg)] border border-transparent'
                                                    }`}
                                            >
                                                <span className="text-left break-words pr-4 leading-tight">{col}</span>
                                                {value === col && (
                                                    <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                                                        <Check size={12} className="text-[var(--on-accent)]" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-center flex flex-col items-center justify-center space-y-3">
                                {search.trim().length >= 2 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(search.trim());
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-xl text-sm md:text-base bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--fg)] hover:brightness-95 transition flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                                            <Check size={14} className="text-[var(--accent)]" strokeWidth={3} />
                                        </div>
                                        <span className="break-words leading-tight">
                                            Use <strong>&ldquo;{search.trim()}&rdquo;</strong>
                                            <span className="block text-[var(--fg-faint)] text-xs mt-0.5">Your school, college or university</span>
                                        </span>
                                    </button>
                                ) : (
                                    <div className="py-6 flex flex-col items-center space-y-3">
                                        <div className="w-12 h-12 rounded-full bg-[var(--chip)] flex items-center justify-center">
                                            <Building2 size={24} className="text-[var(--fg-faint)]" />
                                        </div>
                                        <p className="text-[var(--fg-faint)] text-xs">Keep typing your institution&apos;s name…</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
