import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'DoItForMe – Student Hustle Platform',
        short_name: 'DoItForMe',
        description:
            "India's first student-to-student gig platform. Post a Hustle to outsource tasks like coding, design, tutoring, and errands. Verified students, escrow payments, instant UPI.",
        start_url: '/',
        display: 'standalone',
        background_color: '#0B0B11',
        theme_color: '#8825F5',
        orientation: 'portrait',
        categories: ['education', 'finance', 'lifestyle', 'productivity'],
        lang: 'en-IN',
        icons: [
            {
                src: '/Doitforme_logo.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/Doitforme_logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
        shortcuts: [
            {
                name: 'Browse Feed',
                url: '/dashboard',
                description: 'See live Hustles and gig opportunities',
            },
            {
                name: 'Post a Hustle',
                url: '/post',
                description: 'Post a task and find student freelancers',
            },
        ],
    };
}
