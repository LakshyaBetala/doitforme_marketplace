import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

// Inbox only, grouped by gig + other person like components/chat/MessagesView.tsx.
// A tap opens the thread (app/chat/[gigId].tsx).
export default function Messages() {
  const { session } = useSession();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const { data: msgs, error: e } = await supabase
      .from('messages')
      .select('*, gig:gigs!gig_id(title, poster_id, assigned_worker_id)')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(300);
    if (e) {
      setError(e.message);
      return;
    }

    // Newest first, so the first message seen per thread is its latest.
    const map = new Map<string, any>();
    for (const m of msgs ?? []) {
      let other = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!other && m.gig) other = uid === m.gig.poster_id ? m.gig.assigned_worker_id : m.gig.poster_id;
      if (!other) continue;
      const key = `${m.gig_id}_${other}`;
      if (!map.has(key)) map.set(key, { key, other, gig: m.gig, last: m });
    }
    const list = [...map.values()];
    const ids = [...new Set(list.map((t) => t.other))];
    const { data: people } = ids.length
      ? await supabase.from('users').select('id, name').in('id', ids)
      : { data: [] as any[] };
    const names = new Map((people ?? []).map((p: any) => [p.id, p.name]));
    setThreads(list.map((t) => ({ ...t, name: names.get(t.other) ?? 'Someone' })));
  }, [session?.user.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.key}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        ListEmptyComponent={
          <Empty
            title={error ? 'Could not load messages' : 'No conversations yet'}
            hint={error || 'Message a poster from a task to start one.'}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: '/chat/[gigId]', params: { gigId: item.last.gig_id, other: item.other, name: item.name } })} style={{ gap: 4 }}>
            <View style={s.row}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.meta}>{timeAgo(item.last.created_at)}</Text>
            </View>
            <Text style={s.gig} numberOfLines={1}>
              {item.gig?.title}
            </Text>
            <Text style={s.preview} numberOfLines={1}>
              {item.last.message_type === 'system' ? 'Update' : item.last.content}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  meta: { color: c.faint, fontSize: 12 },
  gig: { color: c.violet, fontSize: 13 },
  preview: { color: c.muted, fontSize: 14 },
});
