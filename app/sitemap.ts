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
        // Post a gig / marketplace listing
        {
            url: `${baseUrl}/post`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        // Profile / onboarding
        {
            url: `${baseUrl}/onboarding`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/profile`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        // Activity hub
        {
            url: `${baseUrl}/gig/my-gigs`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.7,
        },
        // Messages
        {
            url: `${baseUrl}/messages`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.6,
        },
        // Payouts / wallet
        {
            url: `${baseUrl}/payouts`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.5,
        },
        // Verify ID
        {
            url: `${baseUrl}/verify`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];
}
