import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Pill } from '../components/ui';
import { humanize, rupees, timeAgo } from '../lib/format';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';

// Ported from app/talent/page.tsx: open SERVICE adverts, newest first. An advert is a
// shopfront, never a transaction: tapping one opens it, and "Request this service" there
// creates a normal engagement through /api/gig/request-service.
export default function Talent() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data, error: e } = await supabase
      .from('gigs')
      .select('id, poster_id, title, description, category, price, status, created_at, users:poster_id(name, college, rating, rating_count, username)')
      .eq('listing_type', 'SERVICE')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(60);
    if (e) setError(e.message);
    setRows(data ?? []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Talent', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        ListEmptyComponent={<Empty title={error ? 'Could not load' : 'No services yet'} hint={error || 'Students publish what they can do here.'} />}
        renderItem={({ item }) => {
          const u = Array.isArray(item.users) ? item.users[0] : item.users;
          return (
            <Card onPress={() => router.push(`/gig/${item.id}`)} style={{ gap: 6 }}>
              <View style={s.row}>
                <Text style={s.title} numberOfLines={2}>{item.title}</Text>
                <Text style={s.price}>from {rupees(item.price)}</Text>
              </View>
              {item.category ? <Pill label={humanize(item.category)} /> : null}
              <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
              <Text style={s.meta}>
                {[u?.name, u?.college, u?.rating ? `★ ${Number(u.rating).toFixed(1)}` : null, timeAgo(item.created_at)].filter(Boolean).join(' · ')}
              </Text>
            </Card>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontSize: 14, fontWeight: '700' },
  desc: { color: c.ink, fontSize: 14, lineHeight: 20 },
  meta: { color: c.muted, fontSize: 12 },
});
