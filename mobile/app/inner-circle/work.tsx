import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Progress, Reveal, ScreenHeader, Stat } from '../../components/ic/kit';
import { Txt } from '../../components/ic/Txt';
import { Button, Card, Empty, Loading } from '../../components/ui';
import { rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';
import { StepRow } from '../../components/ic/Workflow';
import { workflowFor, workflowHeadline } from '../../shared/innerCircle';

// Every step is COMPUTED by workflowFor() from the gig row (shared with the website), never
// stored, so this tracker cannot disagree with the escrow it describes.
export default function Briefs() {
  const { session, profile } = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefs, setBriefs] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const allowed = Boolean(profile?.is_elite) && profile?.inner_circle_role === 'TECH';

  const load = useCallback(async () => {
    if (!session || !allowed) return setLoading(false);
    const uid = session.user.id;
    const { data: gigs, error: e } = await supabase
      .from('gigs')
      .select('id, title, price, status, payment_status, assigned_worker_id, poster_id, delivered_at, auto_release_at, dispute_reason, created_at, companies:company_id(name)')
      .eq('assigned_worker_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (e) setError(e.message);
    // Paid-ness lives in payout_queue, not on the gig.
    const { data: payouts } = await supabase.from('payout_queue').select('gig_id, status').eq('worker_id', uid);
    const paid = new Set((payouts ?? []).filter((x: any) => String(x.status).toLowerCase() === 'completed').map((x: any) => x.gig_id));
    const rows = (gigs ?? []).map((g: any) => ({ ...g, paid_out: paid.has(g.id) }));
    setBriefs(rows);
    // Open the one that needs them, not just the newest.
    const needsYou = rows.find((g: any) => {
      const h = workflowHeadline(workflowFor(g));
      return h && (h.state === 'blocked' || (h.state === 'current' && h.owner === 'you'));
    });
    setOpenId((cur) => cur ?? (needsYou ?? rows[0])?.id ?? null);
    setLoading(false);
  }, [session, allowed]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stats = useMemo(() => {
    let active = 0, need = 0, paid = 0;
    for (const g of briefs) {
      const steps = workflowFor(g);
      const h = workflowHeadline(steps);
      if (steps.every((x) => x.state === 'done')) paid += 1;
      else active += 1;
      if (h && (h.state === 'blocked' || (h.state === 'current' && h.owner === 'you'))) need += 1;
    }
    return { active, need, paid };
  }, [briefs]);

  if (loading) return <Loading />;

  if (!allowed) {
    return (
      <View style={s.page}>
        <ScreenHeader eyebrow="The Inner Circle" title="My briefs" />
        <View style={{ padding: 20 }}>
          <Card style={{ gap: 10 }}>
            <View style={s.lock}><Ionicons name="lock-closed-outline" size={20} color={c.muted} /></View>
            <Txt v="heading">This is for Inner Circle builders</Txt>
            <Txt v="small">Company briefs are handed out here. You can ask to join. A person reads every application.</Txt>
            <Button label="About the Inner Circle" icon="arrow-forward" onPress={() => router.replace('/inner-circle')} />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.violet} />}
    >
      <ScreenHeader eyebrow="The Inner Circle" title="My briefs" subtitle="Every brief you have been put forward for, and exactly where it has got to. If a step says it is your move, it is." />
      <View style={{ padding: 20, gap: 16 }}>
        <Reveal i={0} style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Active" value={stats.active} />
          <Stat label="Need you" value={stats.need} tone={stats.need ? 'orange' : 'ink'} />
          <Stat label="Finished" value={stats.paid} tone="ok" />
        </Reveal>

        {error ? <Txt v="small" style={{ color: c.bad }}>{error}</Txt> : null}

        {briefs.length === 0 ? (
          <Empty
            icon="hammer-outline"
            title="No briefs yet"
            hint="We put members forward as company work comes in. Keep your profile and payout details current. They are what we point to."
          />
        ) : (
          briefs.map((g, idx) => {
            const steps = workflowFor(g);
            const head = workflowHeadline(steps);
            const doneCount = steps.filter((x) => x.state === 'done').length;
            const finished = doneCount === steps.length;
            const mine = head && head.state !== 'blocked' && head.owner === 'you' && !finished;
            const blocked = head?.state === 'blocked';
            const open = openId === g.id;
            return (
              <Reveal key={g.id} i={idx + 1}>
                <Card onPress={() => setOpenId(open ? null : g.id)} style={[s.brief, mine && s.briefMine, blocked && s.briefBlocked]}>
                  <View style={s.top}>
                    <View style={{ flex: 1, gap: 6 }}>
                      {g.companies?.name ? (
                        <View style={s.company}><Txt v="caption" style={{ color: c.muted, fontWeight: '700' }}>{g.companies.name}</Txt></View>
                      ) : null}
                      <Txt v="heading" numberOfLines={2} style={{ fontSize: 17 }}>{g.title}</Txt>
                    </View>
                    {g.price != null ? <Txt v="num" style={{ fontSize: 19 }}>{rupees(g.price)}</Txt> : null}
                  </View>

                  <View style={{ gap: 7 }}>
                    <Progress value={doneCount} total={steps.length} color={finished ? c.ok : blocked ? c.bad : c.violet} />
                    <View style={s.rowBetween}>
                      <Txt v="small" numberOfLines={1} style={{ flex: 1, fontWeight: '700', color: blocked ? c.bad : mine ? c.orangeInk : c.muted }}>
                        {finished ? 'Finished and paid' : head?.title}
                      </Txt>
                      <Txt v="caption">{doneCount} of {steps.length}</Txt>
                    </View>
                  </View>

                  {open ? (
                    <View style={{ marginTop: 6 }}>
                      {steps.map((st, i) => (
                        <StepRow key={st.key} step={st} last={i === steps.length - 1} />
                      ))}
                      <View style={{ gap: 10, marginTop: 14 }}>
                        <Button label="Open the brief" icon="arrow-forward" onPress={() => router.push(`/gig/${g.id}`)} />
                        {g.poster_id ? (
                          <Button
                            label="Message the client"
                            variant="outline"
                            icon="chatbubble-ellipses-outline"
                            onPress={() => router.push({ pathname: '/chat/[gigId]', params: { gigId: g.id, other: g.poster_id, name: g.companies?.name ?? 'Client' } })}
                          />
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View style={s.more}>
                      <Txt v="caption" style={{ color: c.violet, fontWeight: '700' }}>Show steps</Txt>
                      <Ionicons name="chevron-down" size={14} color={c.violet} />
                    </View>
                  )}
                </Card>
              </Reveal>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.page },
  lock: { width: 44, height: 44, borderRadius: 13, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  brief: { gap: 14, padding: 18 },
  briefMine: { borderColor: c.orange, borderWidth: 1.5 },
  briefBlocked: { borderColor: c.bad, borderWidth: 1.5 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  company: { alignSelf: 'flex-start', backgroundColor: c.violetSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
