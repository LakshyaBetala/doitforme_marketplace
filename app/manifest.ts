import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'DoItForMe - Student Marketplace',
        short_name: 'DoItForMe',
        description: 'India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0B0B11',
        theme_color: '#0B0B11',
        icons: [
            {
                src: '/Doitforme_logo.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    };
}
