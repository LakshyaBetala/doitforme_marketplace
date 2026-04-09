import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';
    const now = new Date();

    return [
        // Core pages
        {
            url: baseUrl,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/about`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/pricing`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/login`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        // Dashboard (gated but crawlable for SEO signals)
        {
            url: `${baseUrl}/dashboard`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        // Post a hustle / gig
        {
            url: `${baseUrl}/post`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        // Public feed
        {
            url: `${baseUrl}/feed`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        // Legal pages
        {
            url: `${baseUrl}/terms`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/privacy-policy`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/refund-policy`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.4,
        },
    ];
}
