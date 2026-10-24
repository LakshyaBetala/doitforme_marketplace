import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Loading, Pill } from '../../components/ui';
import { humanize, rupees, timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

// Read-only detail, queries ported from app/gig/[id]/page.tsx. Applying, hiring and
// delivering call cookie-only API routes, so those buttons open the website for now.
export default function GigDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gig, setGig] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [applicants, setApplicants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.from('gigs').select('*').eq('id', id).single();
      if (e || !data) {
        setError(e?.message ?? 'Task not found');
        setLoading(false);
        return;
      }
      setGig(data);
      const [p, a] = await Promise.all([
        supabase.from('users').select('name, avatar_url, rating, college').eq('id', data.poster_id).single(),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('gig_id', id),
      ]);
      setPoster(p.data);
      setApplicants(a.count ?? 0);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!gig) return <Empty title="Could not open this task" hint={error} />;

  const images: string[] = Array.isArray(gig.images) ? gig.images : [];
  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <Text style={s.title}>{gig.title}</Text>
        <Text style={s.price}>{rupees(gig.price)}</Text>
        <View style={s.pills}>
          <Pill label={humanize(gig.status)} tone={gig.status === 'open' ? 'ok' : 'warn'} />
          {gig.category ? <Pill label={humanize(gig.category)} /> : null}
          {gig.location ? <Pill label={gig.location} /> : null}
        </View>
        <Text style={s.meta}>
          Posted {timeAgo(gig.created_at)} · {applicants} applied
          {gig.deadline ? ` · due ${new Date(gig.deadline).toLocaleDateString('en-IN')}` : ''}
        </Text>
      </Card>

      {gig.description ? (
        <Card>
          <Text style={s.h}>About this task</Text>
          <Text style={s.body}>{gig.description}</Text>
        </Card>
      ) : null}

      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((path) => {
            const url = supabase.storage.from('gig-images').getPublicUrl(path).data.publicUrl;
            return <Image key={path} source={{ uri: url }} style={s.img} />;
          })}
        </ScrollView>
      ) : null}

      <Card style={{ gap: 4 }}>
        <Text style={s.h}>Posted by</Text>
        <Text style={s.body}>{poster?.name ?? 'Unknown'}</Text>
        {poster?.college ? <Text style={s.meta}>{poster.college}</Text> : null}
        {poster?.rating ? <Text style={s.meta}>Rating {Number(poster.rating).toFixed(1)}</Text> : null}
      </Card>

      <Button label="Open on website to apply" onPress={() => Linking.openURL(`https://www.doitforme.in/gig/${id}`)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { color: c.inkStrong, fontSize: 22, fontWeight: '700' },
  price: { color: c.violet, fontSize: 20, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  meta: { color: c.muted, fontSize: 13 },
  h: { color: c.inkStrong, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  img: { width: 220, height: 160, borderRadius: 12, backgroundColor: c.violetSoft },
});
