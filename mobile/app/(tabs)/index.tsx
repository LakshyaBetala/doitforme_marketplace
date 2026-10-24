import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GigCard } from '../../components/GigCard';
import { Button, Card, Loading } from '../../components/ui';
import { rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

type Action = { id: string; gigId: string; tone: 'act' | 'wait'; label: string; detail: string };
const lower = (v: unknown) => String(v ?? '').toLowerCase();

// Home tab. Ported from app/dashboard/page.tsx: one list of what needs the person today, built from
// the same gig rows and rules, plus what they are owed and a short taste of the board.
export default function Home() {
  const { session, profile } = useSession();
  const [actions, setActions] = useState<Action[]>([]);
  const [owed, setOwed] = useState(0);
  const [paid, setPaid] = useState(0);
  const [fresh, setFresh] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const nowIso = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [posted, working, payouts, board] = await Promise.all([
      supabase.from('gigs').select('id, title, status, payment_status, price, auto_release_at, applications(count)').eq('poster_id', uid).not('status', 'in', '(completed,cancelled)').order('created_at', { ascending: false }).limit(30),
      supabase.from('gigs').select('id, title, status, payment_status, price, auto_release_at').eq('assigned_worker_id', uid).not('status', 'in', '(completed,cancelled)').order('created_at', { ascending: false }).limit(30),
      supabase.from('payout_queue').select('amount, status').eq('worker_id', uid),
      supabase
        .from('gigs')
        .select('*, users:poster_id(college), companies:company_id(name), applications(count)')
        .neq('poster_id', uid)
        .eq('status', 'open')
        .is('assigned_worker_id', null)
        .is('source_service_id', null)
        .in('listing_type', ['HUSTLE', 'COMPANY_TASK'])
        .or(`deadline.is.null,deadline.gt.${nowIso}`)
        .or(`listing_type.eq.COMPANY_TASK,created_at.gt.${thirtyDaysAgo}`)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const items: Action[] = [];
    for (const g of (posted.data as any[]) ?? []) {
      const st = lower(g.status);
      const pay = lower(g.payment_status);
      const n = Array.isArray(g.applications) ? g.applications[0]?.count ?? 0 : 0;
      if (st === 'open' && n > 0) items.push({ id: `pick-${g.id}`, gigId: g.id, tone: 'act', label: `${n} ${n === 1 ? 'person' : 'people'} applied`, detail: g.title });
      // Nothing starts until escrow is funded, so this is the most expensive item to leave sitting.
      else if (st === 'assigned' && pay !== 'held') items.push({ id: `fund-${g.id}`, gigId: g.id, tone: 'act', label: 'Add money to escrow to start', detail: g.title });
      else if (st === 'delivered') {
        const hrs = g.auto_release_at ? Math.max(0, Math.round((new Date(g.auto_release_at).getTime() - Date.now()) / 36e5)) : null;
        items.push({ id: `review-${g.id}`, gigId: g.id, tone: 'act', label: 'Work delivered. Review it', detail: hrs !== null ? `${g.title} · releases on its own in ${hrs}h` : g.title });
      }
    }
    for (const g of (working.data as any[]) ?? []) {
      const st = lower(g.status);
      if (st === 'assigned') items.push({ id: `deliver-${g.id}`, gigId: g.id, tone: 'act', label: lower(g.payment_status) === 'held' ? 'Money is held. Submit your work' : 'You are hired for this', detail: g.title });
      else if (st === 'delivered') items.push({ id: `await-${g.id}`, gigId: g.id, tone: 'wait', label: 'Waiting for the client to approve', detail: g.title });
    }
    items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'act' ? -1 : 1));
    setActions(items.slice(0, 6));

    const rows = (payouts.data as any[]) ?? [];
    setOwed(rows.filter((p) => lower(p.status) === 'pending').reduce((n, p) => n + Number(p.amount || 0), 0));
    setPaid(rows.filter((p) => lower(p.status) === 'completed').reduce((n, p) => n + Number(p.amount || 0), 0));
    setFresh(((board.data as any[]) ?? []).map((g) => ({ ...g, applicant_count: Array.isArray(g.applications) ? g.applications[0]?.count ?? 0 : 0 })));
  }, [session?.user.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <Loading />;
  const first = String(profile?.name ?? session?.user.email?.split('@')[0] ?? 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const needs = actions.filter((a) => a.tone === 'act').length;

  return (
    <ScrollView
      style={{ backgroundColor: c.page }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View>
        <Text style={s.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        <Text style={s.hi}>{greeting}, {first}</Text>
        <Text style={s.sub}>
          {needs > 0 ? `${needs} ${needs === 1 ? 'thing needs' : 'things need'} you today.` : actions.length > 0 ? 'Nothing needs you right now. A couple of things are with other people.' : 'Nothing waiting on you. Good time to find work.'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button label="Post a task" onPress={() => router.push('/post')} /></View>
        <View style={{ flex: 1 }}><Button label="Find work" variant="ghost" onPress={() => router.push('/feed')} /></View>
      </View>

      {actions.length ? (
        <Card style={{ gap: 12 }}>
          <Text style={s.h}>Today</Text>
          {actions.map((a) => (
            <Text key={a.id} onPress={() => router.push(`/gig/${a.gigId}`)} style={s.action}>
              <Text style={[s.dot, { color: a.tone === 'act' ? c.orange : c.faint }]}>● </Text>
              <Text style={s.actionLabel}>{a.label}{'\n'}</Text>
              <Text style={s.actionDetail}>{a.detail}</Text>
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 6 }}>
        <Text style={s.h}>Earnings</Text>
        <View style={s.row}><Text style={s.muted}>On its way to you</Text><Text style={s.v}>{rupees(owed)}</Text></View>
        <View style={s.row}><Text style={s.muted}>Paid out so far</Text><Text style={s.v}>{rupees(paid)}</Text></View>
        <Text style={s.link} onPress={() => router.push('/payouts')}>See payouts</Text>
      </Card>

      {fresh.length ? (
        <View style={{ gap: 10 }}>
          <Text style={s.h}>Fresh on the board</Text>
          {fresh.map((g) => <GigCard key={g.id} gig={g} />)}
        </View>
      ) : null}

      <Button label="See all my work" variant="ghost" onPress={() => router.push('/activity')} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  date: { color: c.faint, fontSize: 13, fontWeight: '700' },
  hi: { color: c.inkStrong, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  sub: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: 6 },
  h: { color: c.inkStrong, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: c.muted, fontSize: 14 },
  v: { color: c.ink, fontSize: 15, fontWeight: '700' },
  link: { color: c.violet, fontWeight: '600', marginTop: 4 },
  action: { lineHeight: 22 },
  dot: { fontSize: 12 },
  actionLabel: { color: c.ink, fontSize: 15, fontWeight: '700' },
  actionDetail: { color: c.muted, fontSize: 13 },
});
