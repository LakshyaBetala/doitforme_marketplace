import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
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
  if (!session) return seg === 'login' ? <Shell /> : <Redirect href="/login" />;

  const complete = Boolean(profile?.phone && profile?.college);
  if (!complete) return seg === 'finish-profile' ? <Shell /> : <Redirect href="/finish-profile" />;
  if (seg === 'login' || seg === 'finish-profile') return <Redirect href="/" />;
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
      <Gate />
    </SessionProvider>
  );
}
