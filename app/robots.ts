import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/about', '/contact', '/login'],
            disallow: ['/dashboard', '/profile/', '/gig/', '/messages/', '/verify', '/post'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
