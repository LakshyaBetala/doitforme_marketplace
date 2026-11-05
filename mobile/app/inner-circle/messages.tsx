import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Reveal, ScreenHeader } from '../../components/ic/kit';
import { Txt } from '../../components/ic/Txt';
import { Card, Empty, Loading } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c, font } from '../../lib/theme';

// Inbox only, grouped by brief + other person like components/chat/MessagesView.tsx.
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
      setLoading(false);
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
    const { data: people } = ids.length ? await supabase.from('users').select('id, name').in('id', ids) : { data: [] as any[] };
    const names = new Map((people ?? []).map((p: any) => [p.id, p.name]));
    setThreads(list.map((t) => ({ ...t, name: names.get(t.other) ?? 'Someone' })));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        ListHeaderComponent={<ScreenHeader eyebrow="The Inner Circle" title="Messages" subtitle="Conversations with the companies behind your briefs." />}
        ListEmptyComponent={
          <Empty
            icon="chatbubbles-outline"
            title={error ? 'Could not load messages' : 'No conversations yet'}
            hint={error || 'When you are put forward for a brief, your chat with the client lives here.'}
          />
        }
        renderItem={({ item, index }) => {
          const initial = String(item.name).trim().charAt(0).toUpperCase();
          return (
            <Reveal i={Math.min(index, 6)} style={{ paddingHorizontal: 20, marginTop: 12 }}>
              <Card onPress={() => router.push({ pathname: '/chat/[gigId]', params: { gigId: item.last.gig_id, other: item.other, name: item.name } })} style={s.row}>
                <View style={s.avatar}>
                  <Txt v="heading" style={{ color: c.violet }}>{initial}</Txt>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={s.between}>
                    <Txt v="body" numberOfLines={1} style={{ flex: 1, fontFamily: font.bold, color: c.inkStrong }}>{item.name}</Txt>
                    <Txt v="caption">{timeAgo(item.last.created_at)}</Txt>
                  </View>
                  <Txt v="caption" numberOfLines={1} style={{ color: c.violet, fontWeight: '600' }}>{item.gig?.title}</Txt>
                  <Txt v="small" numberOfLines={1}>{item.last.message_type === 'system' ? 'Update' : item.last.content}</Txt>
                </View>
              </Card>
            </Reveal>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
