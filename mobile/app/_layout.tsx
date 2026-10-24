import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AlertsProvider } from '../lib/alerts';
import { SessionProvider, useSession } from '../lib/session';
import { c } from '../lib/theme';

// Same two gates as the web: signed in (proxy.ts), then profile complete
// (app/dashboard/layout.tsx sends missing phone/college to /onboarding).
function Gate() {
  const { session, profile, loading } = useSession();
  const seg = useSegments()[0] as string | undefined;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.darkBg, justifyContent: 'center' }}>
        <ActivityIndicator color={c.softPurple} />
      </View>
    );
  }
  // Business sign-up runs while signed in but before a company profile exists.
  if (seg === 'company-register' && profile?.role !== 'COMPANY') return <Shell />;
  if (!session) return seg === 'login' ? <Shell /> : <Redirect href="/login" />;

  // Companies have their own tabs and no phone/college gate (that one is for students).
  if (profile?.role === 'COMPANY') {
    const away = seg === '(tabs)' || seg === 'login' || seg === 'finish-profile' || seg === 'company-register';
    return away ? <Redirect href="/company" /> : <Shell />;
  }

  const complete = Boolean(profile?.phone && profile?.college);
  if (!complete) return seg === 'finish-profile' ? <Shell /> : <Redirect href="/finish-profile" />;
  if (seg === 'login' || seg === 'finish-profile') return <Redirect href="/" />;
  if (seg === 'company') return <Redirect href="/" />;
  return <Shell />;
}

function Shell() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.page } }}>
      <Stack.Screen name="gig/[id]" options={{ headerShown: true, title: 'Task', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
    </Stack>
  );
}

export default function Root() {
  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <AlertsProvider>
        <Gate />
      </AlertsProvider>
    </SessionProvider>
  );
}
