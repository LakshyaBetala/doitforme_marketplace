import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

    return {
        rules: [
            {
                // Standard search bots
                userAgent: '*',
                allow: [
                    '/',
                    '/login',
                    '/dashboard',
                    '/post',
                    '/onboarding',
                    '/gig/',
                    '/verify',
                ],
                disallow: [
                    '/api/',
                    '/profile/',         // private
                    '/messages/',        // private
                    '/payouts/',         // private
                    '/dashboard/admin/', // admin only
                    '/_next/',
                ],
            },
            {
                // AI crawlers (GPTBot, ClaudeBot, etc.) — let them index everything public
                // so DoItForMe appears in AI search results and LLM training
                userAgent: [
                    'GPTBot',
                    'ClaudeBot',
                    'Google-Extended',
                    'PerplexityBot',
                    'Amazonbot',
                    'FacebookBot',
                    'Applebot',
                    'anthropic-ai',
                    'CCBot',
                    'omgili',
                    'YouBot',
                ],
                allow: [
                    '/',
                    '/login',
                    '/dashboard',
                    '/post',
                    '/gig/',
                ],
                disallow: [
                    '/api/',
                    '/profile/',
                    '/messages/',
                    '/payouts/',
                    '/dashboard/admin/',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
