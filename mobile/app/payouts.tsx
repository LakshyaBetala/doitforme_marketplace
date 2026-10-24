import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Pill } from '../components/ui';
import { humanize, rupees, timeAgo, toneFor } from '../lib/format';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';

// Ported from app/payouts/page.tsx. Payouts to workers are manual (settled within 24–48
// hours from the admin desk), so this is a status view, never a withdrawable balance.
export default function Payouts() {
  const { session } = useSession();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    supabase
      .from('payout_queue')
      .select('*, gig:gigs!gig_id(title)')
      .eq('worker_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        setRows(data ?? []);
        setLoading(false);
      });
  }, [session]);

  const pending = rows.filter((r) => r.status === 'PENDING').reduce((n, r) => n + Number(r.amount), 0);

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Earnings', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <Card style={{ gap: 4, marginBottom: 4 }}>
            <Text style={s.muted}>Pending payout</Text>
            <Text style={s.big}>{rupees(pending)}</Text>
            <Text style={s.muted}>Payouts are sent to your UPI ID within 24–48 hours of approval.</Text>
          </Card>
        }
        ListEmptyComponent={<Empty title={error ? 'Could not load' : 'No payouts yet'} hint={error || 'Approved work shows up here.'} />}
        renderItem={({ item }) => (
          <Card style={{ gap: 6 }}>
            <View style={s.row}>
              <Text style={s.title} numberOfLines={2}>{item.gig?.title ?? 'Task'}</Text>
              <Text style={s.amount}>{rupees(item.amount)}</Text>
            </View>
            <Pill label={humanize(item.status)} tone={toneFor(item.status)} />
            <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  muted: { color: c.muted, fontSize: 13 },
  big: { color: c.violet, fontSize: 28, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  amount: { color: c.violet, fontSize: 16, fontWeight: '700' },
});
