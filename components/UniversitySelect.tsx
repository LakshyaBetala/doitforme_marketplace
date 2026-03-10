"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, Building2, MapPin } from "lucide-react";

// Helper type for grouping
type CollegeGroup = {
    label: string;
    items: string[];
};

export const COLLEGES: string[] = [
    // --- PRIMARY MARKET (TOP OF LIST) ---
    "SRM Institute of Science and Technology (Kattankulathur)",
    "SRM Institute of Science and Technology (Ramapuram)",
    "SRM Institute of Science and Technology (Vadapalani)",
    "SRM Institute of Science and Technology (NCR)",
    "SRM University AP",
    "VIT Vellore",
    "VIT Chennai",

    // --- CHENNAI & TAMIL NADU (Popular Commerce & Engineering) ---
    "Anna University (CEG/MIT/ACT)",
    "NIT Trichy",
    "SSN College of Engineering",
    "PSG College of Technology",
    "Loyola College",
    "Madras Christian College (MCC)",
    "Stella Maris College",
    "Presidency College, Chennai",
    "Sathyabama Institute of Science and Technology",
    "Hindustan Institute of Technology and Science",
    "Saveetha University",
    "BS Abdur Rahman Crescent Institute",
    "Vels University",
    "MOP Vaishnav College for Women",
    "DG Vaishnav College",
    "Ethiraj College for Women",
    "Rajalakshmi Engineering College",
    "SASTRA Deemed University",
    "Meenakshi College for Women",
    "Madras Institute of Technology (MIT)",
    "Ramakrishna Mission Vivekananda College",
    "Women's Christian College (WCC)",
    "Coimbatore Institute of Technology",
    "Kumaraguru College of Technology",

    // --- REST OF INDIA (Top 25) ---
    "IIT Bombay",
    "IIT Delhi",
    "IIT Madras",
    "IIT Kanpur",
    "IIT Kharagpur",
    "IIT Roorkee",
    "IIT Guwahati",
    "IIIT Hyderabad",
    "IIIT Bangalore",
    "IIIT Delhi",
    "NIT Surathkal",
    "NIT Warangal",
    "NIT Calicut",
    "NIT Rourkela",
    "BITS Pilani",
    "BITS Goa",
    "BITS Hyderabad",
    "Delhi University (DU)",
    "Jadavpur University",
    "Banaras Hindu University (BHU)",
    "Jawaharlal Nehru University (JNU)",
    "Jamia Millia Islamia",
    "Manipal Academy of Higher Education (MAHE)",
    "Christ University, Bangalore",
    "Symbiosis International (Pune)",
    "NMIMS Mumbai",
    "Ashoka University",
    "SRM University AP",
    "Thapar Institute of Engineering and Technology",
    "National Law School of India University (NLSIU)",

    // --- FALLBACK ---
    "Other"
];

interface Props {
    value: string;
    onChange: (val: string) => void;
}

export default function UniversitySelect({ value, onChange }: Props) {
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
            <label className="block text-[10px] font-bold text-white/60 mb-2 ml-1 uppercase tracking-wider">
                Select University
            </label>

            {/* TRIGGER BUTTON */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base flex justify-between items-center cursor-pointer hover:border-[#8825F5]/50 focus:border-[#8825F5] focus:outline-none focus:ring-1 focus:ring-[#8825F5] transition-all group shadow-sm text-left"
            >
                <div className="flex items-center gap-3 truncate pr-4">
                    <Building2 size={18} className="text-white/40 group-hover:text-brand-purple shrink-0 transition-colors" />
                    <span className={`truncate ${value ? "text-white font-medium" : "text-white/40"}`}>
                        {value || "Search for your college..."}
                    </span>
                </div>
                <ChevronDown size={18} className={`text-white/40 transition-transform shrink-0 ${isOpen ? "rotate-180 text-brand-purple" : ""}`} />
            </button>

            {/* DROPDOWN MENU */}
            {isOpen && (
                <div
                    className="absolute z-[9999] w-full mt-2 bg-[#1A1A24] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    onKeyDown={handleKeyDown}
                >
                    {/* SEARCH BOX */}
                    <div className="p-3 border-b border-white/5 flex items-center gap-3 bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                        <Search size={18} className="text-white/40 ml-1" />
                        <input
                            type="text"
                            placeholder="Type to search..."
                            className="bg-transparent border-none outline-none text-white text-base w-full font-sans placeholder:text-white/30"
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
                                    <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                        <MapPin size={12} className="text-brand-purple" /> Top Campuses
                                    </div>
                                )}

                                {filteredColleges.map((col, index) => {
                                    // Add a separator before "Other"
                                    const isOther = col === "Other";

                                    return (
                                        <div key={col}>
                                            {isOther && <div className="h-px bg-white/10 my-2 mx-2"></div>}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onChange(col);
                                                    setIsOpen(false);
                                                    setSearch("");
                                                }}
                                                className={`w-full text-left px-4 py-3 rounded-xl text-sm md:text-base cursor-pointer flex items-center justify-between transition-all group ${value === col
                                                        ? 'bg-[#8825F5]/20 text-white font-bold border border-[#8825F5]/30'
                                                        : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                                                    }`}
                                            >
                                                <span className="truncate pr-4">{col}</span>
                                                {value === col && (
                                                    <div className="w-5 h-5 rounded-full bg-[#8825F5] flex items-center justify-center shrink-0">
                                                        <Check size={12} className="text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                    <Building2 size={24} className="text-white/20" />
                                </div>
                                <div>
                                    <p className="text-white/80 font-medium">No results found</p>
                                    <p className="text-white/40 text-xs mt-1">Try selecting "Other" at the bottom</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
