import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Pill } from '../../components/ui';
import { humanize, rupees, timeAgo, toneFor } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

// Queries ported from app/activity/page.tsx. Read-only: approve/deliver call
// cookie-only API routes, so they stay on the website until the Bearer fallback ships.
export default function Activity() {
  const { session } = useSession();
  const [tab, setTab] = useState<'working' | 'hiring'>('working');
  const [hiring, setHiring] = useState<any[]>([]);
  const [working, setWorking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const [posts, apps] = await Promise.all([
      supabase
        .from('gigs')
        .select('*, worker:users!assigned_worker_id(name, phone), applications(count)')
        .eq('poster_id', uid)
        .order('created_at', { ascending: false }),
      supabase
        .from('applications')
        .select('*, gig:gigs(*, poster:users!poster_id(name, phone))')
        .eq('worker_id', uid)
        .order('created_at', { ascending: false }),
    ]);
    setError(posts.error?.message ?? apps.error?.message ?? '');
    setHiring(posts.data ?? []);
    setWorking((apps.data ?? []).filter((a: any) => a.gig));
  }, [session?.user.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const rows =
    tab === 'hiring'
      ? hiring.map((g) => ({
          id: g.id,
          title: g.title,
          price: g.price,
          status: g.status,
          at: g.created_at,
          sub: g.worker?.name ? `Worker: ${g.worker.name}` : `${g.applications?.[0]?.count ?? 0} applicants`,
        }))
      : working.map((a) => ({
          id: a.gig.id,
          title: a.gig.title,
          price: a.gig.price,
          status: a.status,
          at: a.created_at,
          sub: a.gig.poster?.name ? `Poster: ${a.gig.poster.name}` : '',
        }));

  return (
    <View style={s.wrap}>
      <View style={s.tabs}>
        {(['working', 'hiring'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <Text style={[s.tabText, tab === k && { color: '#fff' }]}>{k === 'working' ? 'Working' : 'Hiring'}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => `${r.id}-${i}`}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          ListEmptyComponent={
            <Empty
              title={
                error
                  ? 'Could not load'
                  : tab === 'working'
                    ? 'You have not applied to anything yet'
                    : 'You have not posted any tasks'
              }
              hint={error || undefined}
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/gig/${item.id}`)} style={{ gap: 6 }}>
              <View style={s.row}>
                <Text style={s.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={s.price}>{rupees(item.price)}</Text>
              </View>
              <Pill label={humanize(item.status)} tone={toneFor(item.status)} />
              <Text style={s.meta}>{[item.sub, timeAgo(item.at)].filter(Boolean).join(' · ')}</Text>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.page },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  tab: { paddingHorizontal: 16, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  tabOn: { backgroundColor: c.violet },
  tabText: { color: c.violet, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontSize: 16, fontWeight: '700' },
  meta: { color: c.muted, fontSize: 13 },
});
