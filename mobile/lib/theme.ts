// Mirrors app/workspace-theme.css (cream workspace) and app/globals.css (dark).
// Keep in step with those files; the same hex values keep the palette identical.
export const c = {
  page: '#fff9ef',
  surface: '#fffdf9',
  raised: '#ffffff',
  line: '#f0e4d9',
  ink: '#2d1937',
  inkStrong: '#341044',
  muted: '#756e7d',
  faint: '#aaa4ad',
  rail: '#341044',
  violet: '#8426b2',
  violetSoft: '#f2e9f8',
  orange: '#ffa51e',
  orangeSoft: '#ffecd0',
  orangeInk: '#a96210',
  ok: '#1f8a4c',
  okSoft: '#e3f4ea',
  bad: '#c0392b',
  badSoft: '#fbe7e4',
  // dark marketing palette, used on the login screen
  darkBg: '#0B0B11',
  darkCard: '#13131A',
  darkFg: '#FAFAFA',
  darkMuted: 'rgba(255,255,255,0.62)',
  brandPurple: '#8825F5',
  softPurple: '#C9A9FF',
};

export const r = { sm: 8, md: 11, lg: 16 };

// The website's grape hero (app/inner-circle/page.tsx): 115deg, #351144 > #5b1479 > #8324af.
export const grape = {
  colors: ['#351144', '#5b1479', '#8324af'] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
  deep: '#251030',
  gold: '#ffd28c', // eyebrow text on grape
  onAccent: '#371448', // text on the orange CTA
};

// One family per weight: Android ignores fontWeight on custom fonts, so a bare
// fontWeight:'700' would render regular. Loaded in app/_layout.tsx.
export const font = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semi: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  display: 'Manrope_700Bold',
  displayHeavy: 'Manrope_800ExtraBold',
};

export const fontFor = (weight?: string | number) => {
  const w = Number(weight ?? 400);
  return w >= 700 ? font.bold : w >= 600 ? font.semi : w >= 500 ? font.medium : font.regular;
};

// Depth comes from a soft grape-tinted shadow, never a grey one.
export const lift = {
  shadowColor: '#341044',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
} as const;
