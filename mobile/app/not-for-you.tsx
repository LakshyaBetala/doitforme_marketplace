import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt } from '../components/ic/Txt';
import { Button } from '../components/ui';
import { SITE } from '../lib/api';
import { useSession } from '../lib/session';
import { c } from '../lib/theme';

// Business accounts have their own dashboard on the website; this app is for Inner Circle members.
export default function NotForYou() {
  const { signOut } = useSession();
  return (
    <SafeAreaView style={s.page}>
      <View style={s.body}>
        <View style={s.icon}>
          <Ionicons name="business-outline" size={28} color={c.violet} />
        </View>
        <Txt v="title" style={{ textAlign: 'center' }}>This app is for Inner Circle members</Txt>
        <Txt v="body" style={{ textAlign: 'center', color: c.muted }}>
          Company accounts run everything from the DoItForMe website: posting briefs, hiring and paying.
        </Txt>
      </View>
      <View style={{ padding: 20, gap: 12 }}>
        <Button label="Open the website" icon="open-outline" onPress={() => Linking.openURL(SITE)} />
        <Button label="Sign out" variant="outline" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.page },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
});
