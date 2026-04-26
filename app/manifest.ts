import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'DoItForMe – Campus Freelance Network',
        short_name: 'DoItForMe',
        description:
            "India's campus freelance network. 700+ verified students completing real tasks for peers and companies. Escrow-protected, instant UPI payouts.",
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
                description: 'Post a task and find verified student hustlers',
            },
        ],
    };
}
