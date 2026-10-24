import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Loading, Pill } from '../../components/ui';
import { humanize, rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';
import { WorkflowStep, workflowFor, workflowHeadline } from '../../shared/innerCircle';

// Ported from app/inner-circle/work/page.tsx. The steps are COMPUTED by workflowFor() from
// the gig row (shared with the website), never stored, so the tracker cannot disagree with
// the escrow it describes.
export default function InnerCircleWork() {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [briefs, setBriefs] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const { data: p } = await supabase.from('users').select('is_elite, inner_circle_role').eq('id', uid).maybeSingle();
    const tech = Boolean(p?.is_elite) && p?.inner_circle_role === 'TECH';
    setAllowed(tech);
    if (!tech) return setLoading(false);

    const { data: gigs, error: e } = await supabase
      .from('gigs')
      .select('id, title, price, status, payment_status, assigned_worker_id, delivered_at, auto_release_at, dispute_reason, created_at, companies:company_id(name)')
      .eq('assigned_worker_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (e) setError(e.message);
    // Paid-ness lives in payout_queue, not on the gig.
    const { data: payouts } = await supabase.from('payout_queue').select('gig_id, status').eq('worker_id', uid);
    const paid = new Set((payouts ?? []).filter((x: any) => String(x.status).toLowerCase() === 'completed').map((x: any) => x.gig_id));
    const rows = (gigs ?? []).map((g: any) => ({ ...g, paid_out: paid.has(g.id) }));
    setBriefs(rows);
    const needsYou = rows.find((g: any) => {
      const h = workflowHeadline(workflowFor(g));
      return h && (h.state === 'blocked' || (h.state === 'current' && h.owner === 'you'));
    });
    setOpenId((needsYou ?? rows[0])?.id ?? null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading />;
  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.page, padding: 16 }}>
        <Stack.Screen options={{ headerShown: true, title: 'My briefs', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
        <Card style={{ gap: 8 }}>
          <Text style={s.h}>This is for Inner Circle builders</Text>
          <Text style={s.body}>Company briefs are handed out here. You can ask to join: a person reads every application.</Text>
          <Button label="About the Inner Circle" onPress={() => router.replace('/inner-circle')} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ headerShown: true, title: 'My briefs', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <Text style={s.body}>Every brief you have been put forward for, and exactly where it has got to. If a step says it is your move, it is.</Text>
      {error ? <Text style={{ color: c.bad }}>{error}</Text> : null}
      {briefs.length === 0 ? <Empty title="No briefs yet" hint="When a company brief is assigned to you it appears here." /> : null}
      {briefs.map((g) => {
        const steps = workflowFor(g);
        const head = workflowHeadline(steps);
        const open = openId === g.id;
        return (
          <Card key={g.id} style={{ gap: 8 }} onPress={() => setOpenId(open ? null : g.id)}>
            <View style={s.row}>
              <Text style={s.title} numberOfLines={2}>{g.title}</Text>
              <Text style={s.price}>{rupees(g.price)}</Text>
            </View>
            <Text style={s.muted}>{[g.companies?.name, head?.title].filter(Boolean).join(' · ')}</Text>
            {open ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {steps.map((st) => (
                  <Step key={st.key} step={st} />
                ))}
                <Button label="Open task" variant="ghost" onPress={() => router.push(`/gig/${g.id}`)} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function Step({ step }: { step: WorkflowStep }) {
  const color = step.state === 'done' ? c.ok : step.state === 'blocked' ? c.bad : step.state === 'current' ? c.orange : c.line;
  return (
    <View style={[s.step, step.state === 'todo' && { opacity: 0.6 }]}>
      <View style={[s.dot, { backgroundColor: color }]}>{step.state === 'done' ? <Text style={s.tick}>✓</Text> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.row}>
          <Text style={[s.stepTitle, (step.state === 'current' || step.state === 'blocked') && { fontWeight: '800' }]}>{step.title}</Text>
          {step.state === 'current' || step.state === 'blocked' ? <Pill label={step.owner === 'you' ? 'Your move' : step.owner === 'client' ? 'With the client' : 'With us'} tone={step.owner === 'you' ? 'warn' : 'neutral'} /> : null}
        </View>
        <Text style={s.muted}>{step.detail}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  h: { color: c.inkStrong, fontSize: 17, fontWeight: '700' },
  body: { color: c.muted, fontSize: 15, lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontSize: 16, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 13, lineHeight: 19 },
  step: { flexDirection: 'row', gap: 10 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tick: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepTitle: { color: c.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
