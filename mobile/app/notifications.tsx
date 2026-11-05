import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Txt } from '../components/ic/Txt';
import { Card, Empty, Loading } from '../components/ui';
import { openLink, useAlerts } from '../lib/alerts';
import { timeAgo } from '../lib/format';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';

const iconFor = (type: string | null): keyof typeof Ionicons.glyphMap =>
  /pay|money|escrow/i.test(type ?? '') ? 'wallet-outline' : /message|chat/i.test(type ?? '') ? 'chatbubble-outline' : 'briefcase-outline';

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
      <Stack.Screen options={{ headerShown: true, title: 'Notifications' }} />
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListEmptyComponent={<Empty icon="notifications-outline" title="You are all caught up" hint="Updates about your briefs and payments show up here." />}
        renderItem={({ item }) => (
          <Card onPress={() => openLink(item.link)} style={s.row}>
            <View style={[s.icon, !item.is_read && { backgroundColor: c.orangeSoft }]}>
              <Ionicons name={iconFor(item.type)} size={18} color={item.is_read ? c.violet : c.orangeInk} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="body" style={{ fontWeight: item.is_read ? '500' : '700', color: c.inkStrong, fontSize: 14.5, lineHeight: 21 }}>{item.content}</Txt>
              <Txt v="caption">{timeAgo(item.created_at)}</Txt>
            </View>
            {!item.is_read ? <View style={s.dot} /> : null}
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.orange, marginTop: 6 },
});
