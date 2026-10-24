import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GigCard } from '../../components/GigCard';
import { Empty, Loading } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { c } from '../../lib/theme';

const PAGE = 20;

export default function Feed() {
  const { profile } = useSession();
  const [campus, setCampus] = useState<'ALL' | 'MY_CAMPUS'>('ALL');
  const [gigs, setGigs] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Query ported from app/feed/page.tsx — keep the filters in step with it.
  const load = useCallback(async (pageIndex: number, replace: boolean) => {
    setError('');
    const nowIso = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    let q = supabase
      .from('gigs')
      .select('*, users:poster_id!inner(college), companies:company_id(name), applications(count)')
      .eq('status', 'open')
      .is('assigned_worker_id', null)
      .is('source_service_id', null)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageIndex * PAGE, pageIndex * PAGE + PAGE - 1)
      .or(`listing_type.eq.COMPANY_TASK,created_at.gt.${thirtyDaysAgo}`)
      .in('listing_type', ['HUSTLE', 'COMPANY_TASK'])
      .or(`deadline.is.null,deadline.gt.${nowIso}`);
    if (campus === 'MY_CAMPUS' && profile?.college) q = q.eq('users.college', profile.college);

    const { data, error: e } = await q;
    if (e) { setError(e.message); return; }
    const rows = (data ?? []).map((g: any) => ({
      ...g,
      applicant_count: Array.isArray(g.applications) ? (g.applications[0]?.count ?? 0) : 0,
    }));
    setGigs((prev) => (replace ? rows : [...prev, ...rows]));
    setMore(rows.length === PAGE);
    setPage(pageIndex);
  }, [campus, profile?.college]);

  useEffect(() => {
    setLoading(true);
    load(0, true).finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={s.wrap}>
      <View style={s.chips}>
        {(['ALL', 'MY_CAMPUS'] as const).map((k) => (
          <Pressable key={k} onPress={() => setCampus(k)} style={[s.chip, campus === k && s.chipOn]}>
            <Text style={[s.chipText, campus === k && { color: '#fff' }]}>{k === 'ALL' ? 'All tasks' : 'My campus'}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <Loading /> : (
        <FlatList
          data={gigs}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GigCard gig={item} />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(0, true); setRefreshing(false); }}
          onEndReached={() => more && load(page + 1, false)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Empty title={error ? 'Could not load tasks' : 'No open tasks right now'} hint={error || 'Pull down to refresh.'} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.page },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  chipOn: { backgroundColor: c.violet },
  chipText: { color: c.violet, fontWeight: '600' },
});
