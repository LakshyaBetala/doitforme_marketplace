import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading } from '../components/ui';
import { openLink, useAlerts } from '../lib/alerts';
import { timeAgo } from '../lib/format';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';

// Ported from components/NotificationBell.tsx: the 20 newest rows of `notifications`.
// Opening the screen marks them read, like opening the bell does on the website.
export default function Notifications() {
  const { session } = useSession();
  const { markAllRead } = useAlerts();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('notifications')
      .select('id, type, content, link, is_read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
        void markAllRead();
      });
  }, [session, markAllRead]);

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Notifications', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Empty title="You are all caught up" hint="Updates about your tasks and payments show up here." />}
        renderItem={({ item }) => (
          <Card onPress={() => openLink(item.link)} style={{ gap: 4 }}>
            <Text style={[s.body, !item.is_read && { fontWeight: '700' }]}>{item.content}</Text>
            <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  body: { color: c.ink, fontSize: 15, lineHeight: 21 },
  muted: { color: c.faint, fontSize: 12 },
});
