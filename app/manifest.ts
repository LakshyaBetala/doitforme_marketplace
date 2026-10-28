import { MetadataRoute } from 'next';

/**
 * The installed-app manifest.
 *
 * Three things changed here and each one was a real defect:
 *
 * 1. Both icon entries pointed at /logo.png — one 1024x1024, 890KB file declared
 *    as 192x192 AND as 512x512. Every install fetched 890KB twice for icons the
 *    browser then downscaled.
 * 2. That same full-bleed file was declared `purpose: "maskable"`. Android crops
 *    a maskable icon (to a circle on most launchers) and the safe zone is the
 *    middle 80%, so the logo lost its edges on the home screen. The maskable
 *    entries are now a separately padded canvas — see scripts/make-app-icons.mjs.
 * 3. start_url was "/", which is the marketing landing page. Someone who has
 *    installed the app has already decided; opening them on a pitch is wrong.
 *    The dashboard redirects to /login when there is no session, so this is safe
 *    for a signed-out install.
 *
 * background_color stays the dark #0B0B11 to match the splash and the landing
 * page the first launch passes through. theme_color is the cream workspace,
 * because that is where the app actually lives — see
 * components/shell/WorkspaceThemeColor.tsx, which keeps the live status bar in
 * step per route.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "DoItForMe",
        short_name: 'DoItForMe',
        description:
            "India's campus hustle network — students, peers, and companies hire each other for real work. Escrow-protected, instant UPI payouts.",
        start_url: '/dashboard',
        id: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0B0B11',
        theme_color: '#fffdf9',
        orientation: 'portrait',
        categories: ['education', 'finance', 'lifestyle', 'productivity'],
        lang: 'en-IN',
        dir: 'ltr',
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // Padded to the 80% safe zone so a circular launcher mask does not
            // clip the artwork.
            { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            {
                name: 'Find work',
                short_name: 'Find work',
                url: '/feed',
                description: 'Open tasks from students and companies',
            },
            {
                name: 'Post a task',
                short_name: 'Post',
                url: '/post',
                description: 'Post a task and get offers from verified students',
            },
            {
                name: 'Messages',
                short_name: 'Messages',
                url: '/messages',
                description: 'Your conversations',
            },
        ],
    };
}
