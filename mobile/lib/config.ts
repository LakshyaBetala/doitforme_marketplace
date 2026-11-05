// This build of the app is for Inner Circle members only. The student and business
// screens are still in app/ (and every route they need still works); the gate in
// app/_layout.tsx simply never lets anyone reach them. Flip this to false to get the
// full app back.
export const INNER_CIRCLE_ONLY = true;

// Routes an Inner Circle app may show. Anything else redirects to the Inner Circle home.
export const IC_ROUTES = new Set([
  'welcome', 'login', 'finish-profile', 'inner-circle', 'gig', 'chat', 'u', 'c', 'notifications',
  'notification-settings', 'edit-profile', 'payouts', 'verify-id', 'not-for-you',
]);
