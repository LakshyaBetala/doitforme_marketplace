import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Splash } from '../components/ic/Splash';
import { AlertsProvider } from '../lib/alerts';
import { IC_ROUTES, INNER_CIRCLE_ONLY } from '../lib/config';
import { SessionProvider, useSession } from '../lib/session';
import { c, font } from '../lib/theme';

// Keep the native splash up until the JS splash (components/ic/Splash.tsx) can take over.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Where this person belongs right now, or null when the current screen is fine. The navigator
// is always mounted next to the <Redirect>: rendering a Redirect INSTEAD of the navigator
// unmounts it, which resets the router (and on web remounts the whole root, wiping state).
type Auth = ReturnType<typeof useSession>;

// Inner Circle build: signed out goes to the welcome screen, a signed-in account must have a
// finished profile (phone and college, which /api/auth/create-user needs), and after that
// only the routes in IC_ROUTES are reachable. Everything else (the student tabs, company
// screens, talent, ...) stays in the repo but redirects to the Inner Circle home.
function innerCircleTarget({ session, profile }: Auth, seg: string | undefined): string | null {
  if (!session) return seg === 'welcome' || seg === 'login' ? null : '/welcome';

  // Business accounts have nothing to do in this app.
  if (profile?.role === 'COMPANY') return seg === 'not-for-you' ? null : '/not-for-you';

  const complete = Boolean(profile?.phone && profile?.college);
  if (!complete) return seg === 'finish-profile' ? null : '/finish-profile';

  const away = !seg || !IC_ROUTES.has(seg) || seg === 'welcome' || seg === 'login' || seg === 'finish-profile' || seg === 'not-for-you';
  return away ? '/inner-circle' : null;
}

// The original full-app gate, used only when INNER_CIRCLE_ONLY is false.
function fullAppTarget({ session, profile }: Auth, seg: string | undefined): string | null {
  // Business sign-up runs while signed in but before a company profile exists.
  if (seg === 'company-register' && profile?.role !== 'COMPANY') return null;
  if (!session) return seg === 'login' ? null : '/login';

  // Companies have their own tabs and no phone/college gate (that one is for students).
  if (profile?.role === 'COMPANY') {
    const away = seg === '(tabs)' || seg === 'login' || seg === 'finish-profile' || seg === 'company-register';
    return away ? '/company' : null;
  }

  const complete = Boolean(profile?.phone && profile?.college);
  if (!complete) return seg === 'finish-profile' ? null : '/finish-profile';
  if (seg === 'login' || seg === 'finish-profile') return '/';
  if (seg === 'company') return '/';
  return null;
}

function Gate() {
  const auth = useSession();
  const seg = useSegments()[0] as string | undefined;
  if (auth.loading) return null; // the splash is still covering the screen
  const target = INNER_CIRCLE_ONLY ? innerCircleTarget(auth, seg) : fullAppTarget(auth, seg);
  return (
    <>
      <Shell />
      {target ? <Redirect href={target as never} /> : null}
    </>
  );
}

function Shell() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: c.page },
        headerTintColor: c.violet,
        headerStyle: { backgroundColor: c.page },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.displayHeavy, color: c.inkStrong },
      }}
    >
      <Stack.Screen
        name="gig/[id]"
        options={{
          headerShown: true,
          title: 'Brief',
          headerTintColor: c.violet,
          headerStyle: { backgroundColor: c.page },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: font.displayHeavy, color: c.inkStrong },
        }}
      />
    </Stack>
  );
}

function Frame({ fontsReady }: { fontsReady: boolean }) {
  const { loading } = useSession();
  const [gone, setGone] = useState(false);
  const done = useCallback(() => setGone(true), []);

  // Hide the native splash once fonts are in: the JS splash is already mounted underneath.
  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <StatusBar style="dark" />
      {fontsReady ? <Gate /> : <ActivityIndicator color={c.violet} style={{ flex: 1 }} />}
      {gone ? null : <Splash ready={fontsReady && !loading} onDone={done} />}
    </View>
  );
}

export default function Root() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  return (
    <SessionProvider>
      <AlertsProvider>
        <Frame fontsReady={loaded || Boolean(error)} />
      </AlertsProvider>
    </SessionProvider>
  );
}
