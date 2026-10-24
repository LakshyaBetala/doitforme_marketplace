import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Pill } from '../../components/ui';
import { humanize, rupees, timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

// Ported from app/u/[username]/page.tsx. Ratings are two reputations kept apart: a rating
// whose gig the person owns is a poster rating, everything else is a worker rating.
const FIELDS = 'id, username, display_name, name, avatar_url, bio, skills, portfolio_links, experience, year_of_study, branch, college, rating, rating_count, jobs_completed, kyc_verified, is_verified_company, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [user, setUser] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [done, setDone] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.from('users').select(FIELDS).eq(UUID.test(username) ? 'id' : 'username', username).maybeSingle();
      if (!u) return setLoading(false);
      setUser(u);
      const [g, w, r] = await Promise.all([
        supabase.from('gigs').select('id, title, price, status, listing_type, created_at').eq('poster_id', u.id).in('status', ['open', 'assigned', 'delivered', 'completed']).order('created_at', { ascending: false }).limit(6),
        supabase.from('gigs').select('id, title, price, listing_type, created_at').eq('assigned_worker_id', u.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(6),
        supabase.from('ratings').select('id, score, review, created_at, gig_id, gig:gigs(poster_id), rater:users!ratings_rater_id_fkey(name, username)').eq('rated_id', u.id).order('created_at', { ascending: false }).limit(50),
      ]);
      setGigs(g.data ?? []);
      setDone(w.data ?? []);
      setReviews(r.data ?? []);
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <Loading />;
  if (!user) return <Empty title="Profile not found" />;

  const roleOf = (r: any) => ((Array.isArray(r.gig) ? r.gig[0] : r.gig)?.poster_id === user.id ? 'POSTER' : 'WORKER');
  const mean = (rows: any[]) => (rows.length ? rows.reduce((a, r) => a + Number(r.score || 0), 0) / rows.length : 0);
  const asWorker = reviews.filter((r) => roleOf(r) === 'WORKER');
  const asPoster = reviews.filter((r) => roleOf(r) === 'POSTER');
  const written = reviews.filter((r) => r.review && String(r.review).trim()).slice(0, 5);
  const name = user.display_name || user.name || `@${user.username}`;
  const sub = [user.branch, user.year_of_study ? `Year ${user.year_of_study}` : null, user.college].filter(Boolean).join(' · ');

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ headerShown: true, title: name, headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <View style={s.avatar}><Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
        <Text style={s.name}>{name}</Text>
        {user.username ? <Text style={s.muted}>@{user.username}</Text> : null}
        <View style={s.pills}>
          {user.kyc_verified ? <Pill label="Verified student" tone="ok" /> : null}
          {user.is_verified_company ? <Pill label="Company" /> : null}
        </View>
        {sub ? <Text style={s.muted}>{sub}</Text> : null}
        <Text style={s.muted}>Member since {new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</Text>
        {user.bio ? <Text style={s.body}>{user.bio}</Text> : null}
      </Card>

      <Card style={{ gap: 8 }}>
        <Row k="Jobs completed" v={String(user.jobs_completed ?? 0)} />
        <Row k="As a worker" v={asWorker.length ? `★ ${mean(asWorker).toFixed(1)} (${asWorker.length})` : 'No ratings yet'} />
        <Row k="As a poster" v={asPoster.length ? `★ ${mean(asPoster).toFixed(1)} (${asPoster.length})` : 'No ratings yet'} />
      </Card>

      {Array.isArray(user.skills) && user.skills.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={s.h}>Skills</Text>
          <View style={s.pills}>{user.skills.map((k: string) => <Pill key={k} label={k} />)}</View>
          {user.experience ? <Text style={s.body}>{user.experience}</Text> : null}
        </Card>
      ) : null}

      {Array.isArray(user.portfolio_links) && user.portfolio_links.length ? (
        <Card style={{ gap: 6 }}>
          <Text style={s.h}>Portfolio</Text>
          {user.portfolio_links.map((l: string) => (
            <Text key={l} style={s.link} numberOfLines={1} onPress={() => Linking.openURL(l.startsWith('http') ? l : `https://${l}`)}>{l}</Text>
          ))}
        </Card>
      ) : null}

      {written.length ? (
        <Card style={{ gap: 10 }}>
          <Text style={s.h}>Reviews</Text>
          {written.map((r) => (
            <View key={r.id} style={{ gap: 2 }}>
              <Text style={s.muted}>★ {r.score} · {Array.isArray(r.rater) ? r.rater[0]?.name : r.rater?.name ?? 'Someone'} · {timeAgo(r.created_at)}</Text>
              <Text style={s.body}>{r.review}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {done.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={s.h}>Completed work</Text>
          {done.map((g) => <Text key={g.id} style={s.body}>{g.title} · {rupees(g.price)}</Text>)}
        </Card>
      ) : null}

      {gigs.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={s.h}>Posts</Text>
          {gigs.map((g) => (
            <Text key={g.id} style={[s.body, { color: c.violet }]} onPress={() => router.push(`/gig/${g.id}`)}>
              {g.title} · {rupees(g.price)} · {humanize(g.status)}
            </Text>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.muted}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.violet, fontSize: 28, fontWeight: '700' },
  name: { color: c.inkStrong, fontSize: 20, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 13 },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  h: { color: c.inkStrong, fontSize: 15, fontWeight: '700' },
  v: { color: c.ink, fontSize: 14, fontWeight: '600' },
  link: { color: c.violet, fontSize: 14 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
