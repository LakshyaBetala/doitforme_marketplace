import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { useSession } from '../lib/session';
import { c } from '../lib/theme';

// Signup writes the users row through cookie-only API routes, so the app cannot
// finish a profile yet. Send people to the site, then re-check when they return.
export default function FinishProfile() {
  const { reload, signOut } = useSession();
  return (
    <View style={s.wrap}>
      <Text style={s.title}>One more step</Text>
      <Text style={s.body}>Add your phone number and college on doitforme.in, then come back and tap “I’m done”.</Text>
      <View style={{ gap: 10, marginTop: 24 }}>
        <Button label="Open doitforme.in" onPress={() => Linking.openURL('https://www.doitforme.in/onboarding')} />
        <Button label="I’m done" variant="ghost" onPress={reload} />
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.page, padding: 24, justifyContent: 'center' },
  title: { color: c.inkStrong, fontSize: 26, fontWeight: '700' },
  body: { color: c.muted, fontSize: 16, marginTop: 8, lineHeight: 22 },
});
