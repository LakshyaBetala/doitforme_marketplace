import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Pill } from '../../components/ui';
import { humanize, rupees } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

// Ported from app/company/[id]/page.tsx: a company's public page and its open tasks.
export default function CompanyPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [co, setCo] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('companies').select('*').eq('id', id).single();
      if (data) {
        setCo(data);
        const g = await supabase.from('gigs').select('*').eq('company_id', id).eq('status', 'open').order('created_at', { ascending: false });
        setGigs(g.data ?? []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!co) return <Empty title="Company not found" />;
  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ headerShown: true, title: co.name, headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <Card style={{ gap: 6 }}>
        <Text style={s.h}>{co.name}</Text>
        {co.company_type ? <Pill label={humanize(co.company_type)} /> : null}
        {co.description ? <Text style={s.body}>{co.description}</Text> : null}
        {co.website ? <Text style={s.link} onPress={() => Linking.openURL(co.website.startsWith('http') ? co.website : `https://${co.website}`)}>{co.website}</Text> : null}
      </Card>
      <Text style={s.h2}>Open tasks</Text>
      {gigs.length === 0 ? <Text style={s.muted}>No open tasks right now.</Text> : null}
      {gigs.map((g) => (
        <Card key={g.id} onPress={() => router.push(`/gig/${g.id}`)} style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.title} numberOfLines={2}>{g.title}</Text>
            <Text style={s.price}>{rupees(g.price)}</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { color: c.inkStrong, fontSize: 20, fontWeight: '700' },
  h2: { color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  link: { color: c.violet },
  muted: { color: c.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontSize: 16, fontWeight: '700' },
});
