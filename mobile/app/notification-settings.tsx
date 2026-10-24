import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, Pill } from '../components/ui';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';

// Same two channels as app/settings/notifications/page.tsx. Push notifications on the
// phone are not built yet, so only email (always on) and Telegram appear here.
const BOT = 'doitforme_alerts_bot';

export default function NotificationSettings() {
  const { session } = useSession();
  const [email, setEmail] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('email, telegram_chat_id').eq('id', session.user.id).single().then(({ data }) => {
      setEmail(data?.email ?? session.user.email ?? null);
      setLinked(Boolean(data?.telegram_chat_id));
    });
  }, [session]);

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ headerShown: true, title: 'Notifications', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <Card style={{ gap: 6 }}>
        <Text style={s.h}>Email</Text>
        <Text style={s.body}>Updates about your tasks, escrow and applications go to {email ?? 'your email'}. These keep your money safe, so they cannot be turned off.</Text>
        <Pill label="Always on" tone="ok" />
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={s.h}>Telegram alerts</Text>
        <Text style={s.body}>Get instant alerts for new tasks and messages. Needs the free Telegram app.</Text>
        {linked ? (
          <Pill label="Linked" tone="ok" />
        ) : (
          <Button label="Connect Telegram" onPress={() => Linking.openURL(`https://t.me/${BOT}?start=${session?.user.id}`)} />
        )}
        {!linked ? <Text style={s.muted}>After tapping Start in Telegram, come back and pull to refresh this screen.</Text> : null}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: c.muted, fontSize: 13 },
});
