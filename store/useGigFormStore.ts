import { create } from 'zustand';

interface GigFormState {
    listingType: "HUSTLE" | "MARKET" | null;
    marketType: "SELL" | "RENT" | "REQUEST";
    itemCondition: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR";
    category: string;
    title: string;
    description: string;
    githubLink: string;
    price: string;
    securityDeposit: string;
    mode: string;
    location: string;
    deadlineDate: string;
    deadlineTime: string;
    setField: (field: keyof GigFormState, value: any) => void;
    reset: () => void;
}

export const useGigFormStore = create<GigFormState>((set) => ({
    listingType: null,
    marketType: "SELL",
    itemCondition: "GOOD",
    category: "",
    title: "",
    description: "",
    githubLink: "",
    price: "",
    securityDeposit: "",
    mode: "Online",
    location: "",
    deadlineDate: "",
    deadlineTime: "",
    setField: (field, value) => set({ [field]: value }),
    reset: () => set({
        listingType: null, marketType: "SELL", itemCondition: "GOOD",
        category: "", title: "", description: "", githubLink: "",
        price: "", securityDeposit: "", mode: "Online", location: "",
        deadlineDate: "", deadlineTime: ""
    })
}));
