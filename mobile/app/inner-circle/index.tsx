import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Fact, Hero, Reveal, ScreenHeader, Stat } from '../../components/ic/kit';
import { Txt } from '../../components/ic/Txt';
import { ErrorText, Field } from '../../components/form';
import { Button, Card, Loading } from '../../components/ui';
import { rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { c, grape, lift, r } from '../../lib/theme';
import {
  APPLICATION_STAGES, INNER_CIRCLE_ROLES, InnerCircleRole, OPEN_STAGES, STAGE_COPY, applicationStage, isOverdue, workflowFor, workflowHeadline,
} from '../../shared/innerCircle';

const ROLE_ICON = { TECH: 'hammer-outline', OUTREACH: 'paper-plane-outline' } as const;
const ROLE_NAME: Record<InnerCircleRole, string> = { TECH: 'Builder', OUTREACH: 'Outreach' };

// The Inner Circle home. One screen, four situations: a member (what needs them today), an
// applicant being reviewed, someone who must verify their student ID first, and someone who can
// apply. Membership (is_elite + inner_circle_role) is only ever set by an admin approving an
// application; nothing here can grant it.
export default function Circle() {
  const { session, profile, reload } = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [data, setData] = useState<{ briefs: any[]; leads: any[]; earned: number }>({ briefs: [], leads: [], earned: 0 });

  const member = Boolean(profile?.is_elite);
  const role = (profile?.inner_circle_role as InnerCircleRole | null) ?? null;

  const load = useCallback(async () => {
    if (!session) return;
    await reload();
    const uid = session.user.id;
    const { data: apps } = await supabase
      .from('inner_circle_applications')
      .select('id, status, decision_note, created_at, role')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1);
    setApplication(apps?.[0] ?? null);

    if (role === 'TECH' && member) {
      const [{ data: gigs }, { data: payouts }] = await Promise.all([
        supabase.from('gigs').select('id, title, price, status, payment_status, assigned_worker_id, delivered_at, auto_release_at, dispute_reason, companies:company_id(name)').eq('assigned_worker_id', uid).limit(50),
        supabase.from('payout_queue').select('gig_id, status, amount').eq('worker_id', uid),
      ]);
      const paid = (payouts ?? []).filter((p: any) => String(p.status).toLowerCase() === 'completed');
      const paidIds = new Set(paid.map((p: any) => p.gig_id));
      setData({
        briefs: (gigs ?? []).map((g: any) => ({ ...g, paid_out: paidIds.has(g.id) })),
        leads: [],
        earned: paid.reduce((n: number, p: any) => n + Number(p.amount ?? 0), 0),
      });
    } else if (role === 'OUTREACH' && member) {
      const { data: leads } = await supabase.from('outreach_leads').select('id, company_name, stage, next_action_at, value_estimate').limit(500);
      setData({ briefs: [], leads: leads ?? [], earned: 0 });
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, role, member]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading && !profile) return <Loading />;
  const first = (profile?.name ?? 'there').trim().split(/\s+/)[0];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.violet} />}
      >
        <ScreenHeader eyebrow="The Inner Circle" title={member ? `Hi, ${first}` : 'Join the Circle'} />
        <View style={{ padding: 20, gap: 22 }}>
          {member && role ? (
            <Member role={role} data={data} />
          ) : (
            <Applicant application={application} onChanged={load} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ----------------------------------- member ------------------------------------ */

function Member({ role, data }: { role: InnerCircleRole; data: { briefs: any[]; leads: any[]; earned: number } }) {
  const tech = role === 'TECH';

  const needs = tech
    ? data.briefs.filter((g) => {
        const h = workflowHeadline(workflowFor(g));
        return h && (h.state === 'blocked' || (h.state === 'current' && h.owner === 'you'));
      })
    : data.leads.filter((l) => isOverdue(l));
  const active = tech ? data.briefs.filter((g) => !workflowFor(g).every((s) => s.state === 'done')).length : data.leads.filter((l) => OPEN_STAGES.includes(l.stage)).length;
  const third = tech ? rupees(data.earned) : String(data.leads.filter((l) => l.stage === 'won').length);

  return (
    <>
      <Reveal i={0}>
        <Hero>
          <View style={s.heroTop}>
            <View style={s.roleChip}>
              <Ionicons name={ROLE_ICON[role]} size={14} color={grape.gold} />
              <Txt v="caption" style={{ color: grape.gold, fontWeight: '700' }}>{ROLE_NAME[role]} member</Txt>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={c.orange} />
          </View>
          <Txt v="title" style={{ color: '#fff', marginTop: 16, fontSize: 24, lineHeight: 29 }}>You are in the Inner Circle</Txt>
          <Txt v="body" style={{ color: 'rgba(255,255,255,0.82)', marginTop: 8, fontSize: 14.5, lineHeight: 22 }}>
            {tech
              ? 'Company briefs come to you first. Keep your profile current so we can put you forward for the right ones.'
              : 'Your pipeline is yours to work. Keep the next action set on every open lead and the day sorts itself.'}
          </Txt>
          <View style={{ marginTop: 18 }}>
            <Button label={tech ? 'See your briefs' : 'Open your pipeline'} icon="arrow-forward" onPress={() => router.push(tech ? '/inner-circle/work' : '/inner-circle/outreach')} />
          </View>
        </Hero>
      </Reveal>

      <Reveal i={1} style={s.stats}>
        <Stat label={tech ? 'Active briefs' : 'Open leads'} value={active} />
        <Stat label={tech ? 'Need you' : 'Overdue'} value={needs.length} tone={needs.length ? (tech ? 'orange' : 'bad') : 'ink'} />
        <Stat label={tech ? 'Paid out' : 'Won'} value={third} tone="ok" />
      </Reveal>

      <Reveal i={2}>
        <Txt v="heading" style={{ marginBottom: 12 }}>{tech ? 'Needs you today' : 'Chase these first'}</Txt>
        {needs.length === 0 ? (
          <Card style={s.caught}>
            <View style={s.caughtIcon}>
              <Ionicons name="checkmark" size={20} color={c.ok} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="body" style={{ fontWeight: '700', color: c.inkStrong }}>You are all caught up</Txt>
              <Txt v="small">{tech ? 'Nothing is waiting on you right now.' : 'No lead is overdue. Nice work.'}</Txt>
            </View>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {needs.slice(0, 4).map((x) =>
              tech ? (
                <Card key={x.id} onPress={() => router.push(`/gig/${x.id}`)} style={s.needRow}>
                  <View style={s.needDot} />
                  <View style={{ flex: 1 }}>
                    <Txt v="body" numberOfLines={1} style={{ fontWeight: '700', color: c.inkStrong }}>{x.title}</Txt>
                    <Txt v="small" numberOfLines={1}>{[x.companies?.name, workflowHeadline(workflowFor(x))?.title].filter(Boolean).join(' · ')}</Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.faint} />
                </Card>
              ) : (
                <Card key={x.id} onPress={() => router.push('/inner-circle/outreach')} style={s.needRow}>
                  <View style={[s.needDot, { backgroundColor: c.bad }]} />
                  <View style={{ flex: 1 }}>
                    <Txt v="body" numberOfLines={1} style={{ fontWeight: '700', color: c.inkStrong }}>{x.company_name}</Txt>
                    <Txt v="small">Next action is overdue</Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.faint} />
                </Card>
              ),
            )}
          </View>
        )}
      </Reveal>

      <Reveal i={3} style={{ gap: 18 }}>
        <Txt v="heading">What membership means</Txt>
        <Fact icon="briefcase-outline" title="Company briefs first" body="You see paid company work before it reaches the open board." />
        <Fact icon="ribbon-outline" title="We vouch for you" body="We put your name forward directly instead of leaving you in a pile." />
        <Fact icon="shield-checkmark-outline" title="Same escrow" body="Nothing changes about how you get paid. Money is held before you start." />
      </Reveal>
    </>
  );
}

/* --------------------------------- not a member --------------------------------- */

function Applicant({ application, onChanged }: { application: any; onChanged: () => Promise<void> }) {
  const { session, profile } = useSession();
  const kyc = (profile?.kyc_verified ? 'approved' : profile?.kyc_status) ?? 'none';
  const [role, setRole] = useState<InnerCircleRole>((application?.role as InnerCircleRole) ?? 'TECH');
  const [pitch, setPitch] = useState('');
  const [links, setLinks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pending = application?.status === 'pending';
  const rejected = application?.status === 'rejected';

  async function apply() {
    setErr('');
    if (pitch.trim().length < 40) return setErr('Tell us a bit more. A couple of sentences about what you do best.');
    if (isDemo()) return setErr('Demo mode: applying is switched off.');
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from('inner_circle_applications').insert({
      user_id: session.user.id,
      role,
      pitch: pitch.trim(),
      links: links.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean).slice(0, 5),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    await onChanged();
  }

  if (pending) {
    // Only the columns known to exist are read, so the stage is "Received" until a person acts.
    const stage = applicationStage({ status: application.status });
    const at = APPLICATION_STAGES.indexOf(stage);
    return (
      <>
        <Reveal i={0}>
          <Hero>
            <View style={s.roleChip}>
              <Ionicons name="time-outline" size={14} color={grape.gold} />
              <Txt v="caption" style={{ color: grape.gold, fontWeight: '700' }}>Being reviewed</Txt>
            </View>
            <Txt v="title" style={{ color: '#fff', marginTop: 16, fontSize: 24, lineHeight: 29 }}>We are reading your application</Txt>
            <Txt v="body" style={{ color: 'rgba(255,255,255,0.82)', marginTop: 8, fontSize: 14.5, lineHeight: 22 }}>
              You applied for {ROLE_NAME[application.role as InnerCircleRole] ?? 'the Circle'}. A person reads every one of these, so it takes a few days. We will email you either way.
            </Txt>
          </Hero>
        </Reveal>
        <Reveal i={1}>
          <Card style={{ gap: 16 }}>
            <Txt v="heading">Where it stands</Txt>
            <View style={s.stages}>
              {APPLICATION_STAGES.map((st, i) => {
                const done = i < at;
                const now = i === at;
                return (
                  <View key={st} style={s.stage}>
                    <View style={s.stageLine}>
                      <View style={[s.seg, i > 0 && { backgroundColor: i <= at ? c.violet : c.line }]} />
                      <View style={[s.node, done && s.nodeDone, now && s.nodeNow]}>
                        {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                      </View>
                      <View style={[s.seg, i < APPLICATION_STAGES.length - 1 && { backgroundColor: i < at ? c.violet : c.line }]} />
                    </View>
                    <Txt v="caption" style={{ textAlign: 'center', color: now ? c.inkStrong : c.faint, fontWeight: now ? '700' : '500', marginTop: 6 }}>{STAGE_COPY[st].label}</Txt>
                  </View>
                );
              })}
            </View>
            <Txt v="small">{STAGE_COPY[stage].hint}</Txt>
          </Card>
        </Reveal>
        <Reveal i={2}>
          <Card style={{ gap: 6 }}>
            <Txt v="body" style={{ fontWeight: '700', color: c.inkStrong }}>While you wait</Txt>
            <Txt v="small">Keep your profile and payout details current. They are what we point to when a brief comes in.</Txt>
            <View style={{ marginTop: 10 }}>
              <Button label="Review my account" variant="ghost" onPress={() => router.push('/inner-circle/me')} />
            </View>
          </Card>
        </Reveal>
      </>
    );
  }

  return (
    <>
      <Reveal i={0}>
        <Hero>
          <Txt v="eyebrow" style={{ color: grape.gold }}>Invite only</Txt>
          <Txt v="title" style={{ color: '#fff', marginTop: 10, fontSize: 26, lineHeight: 31 }}>A small group we put in front of real companies first</Txt>
          <Txt v="body" style={{ color: 'rgba(255,255,255,0.82)', marginTop: 10, fontSize: 14.5, lineHeight: 22 }}>
            Paid briefs, proper budgets, and work worth putting your name on. Ask to join below.
          </Txt>
        </Hero>
      </Reveal>

      <Reveal i={1} style={{ gap: 12 }}>
        <Txt v="heading">There are two ways in</Txt>
        {INNER_CIRCLE_ROLES.map((x) => (
          <Card key={x.value} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={s.roleIcon}>
              <Ionicons name={ROLE_ICON[x.value]} size={20} color={c.orangeInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="body" style={{ fontWeight: '700', color: c.inkStrong }}>
                {x.label} <Txt v="small">· {x.tagline}</Txt>
              </Txt>
              <Txt v="small" style={{ marginTop: 3 }}>{x.blurb}</Txt>
            </View>
          </Card>
        ))}
      </Reveal>

      {rejected ? (
        <Reveal i={2}>
          <Card style={{ gap: 6, borderColor: c.line }}>
            <Txt v="body" style={{ fontWeight: '700', color: c.inkStrong }}>Last time</Txt>
            {application.decision_note ? <Txt v="small">{application.decision_note}</Txt> : null}
            <Txt v="small">You can apply again below.</Txt>
          </Card>
        </Reveal>
      ) : null}

      {/* Verified students only, and the database says so too: the insert policy requires an
          approved ID, so without this step the form would submit and come back 42501. */}
      {kyc !== 'approved' ? (
        <Reveal i={2}>
          <Card style={{ gap: 10 }}>
            <View style={s.step}>
              <Ionicons name="shield-checkmark-outline" size={14} color={c.orangeInk} />
              <Txt v="caption" style={{ color: c.orangeInk, fontWeight: '700' }}>One step first</Txt>
            </View>
            <Txt v="heading">Verify your student ID to apply</Txt>
            <Txt v="small">
              {kyc === 'manual_review'
                ? 'Your ID is being checked by hand. As soon as it clears you can apply. Nothing else is needed from you.'
                : kyc === 'rejected'
                  ? 'Your last ID could not be verified. Upload a clearer photo of the front of your card and you can apply straight after.'
                  : 'We put this group in front of real companies and vouch for them by name, so we confirm you are a student first. It takes a few seconds and is usually instant.'}
            </Txt>
            {kyc !== 'manual_review' ? <Button label={kyc === 'rejected' ? 'Upload a new photo' : 'Verify my ID'} icon="arrow-forward" onPress={() => router.push('/verify-id')} /> : null}
          </Card>
        </Reveal>
      ) : (
        <Reveal i={2}>
          <Card style={{ gap: 16 }}>
            <View>
              <Txt v="heading">Ask to join</Txt>
              <Txt v="small" style={{ marginTop: 4 }}>There is no form to game. Tell us what you are genuinely good at and show us something you have made.</Txt>
            </View>

            <View style={{ gap: 10 }}>
              <Txt v="small" style={{ color: c.inkStrong, fontWeight: '700' }}>Which one are you applying for?</Txt>
              {INNER_CIRCLE_ROLES.map((x) => {
                const on = role === x.value;
                return (
                  <Pressable key={x.value} onPress={() => setRole(x.value)} style={[s.pick, on && s.pickOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Ionicons name={ROLE_ICON[x.value]} size={20} color={on ? c.violet : c.faint} />
                    <View style={{ flex: 1 }}>
                      <Txt v="body" style={{ fontWeight: '700', color: c.inkStrong }}>{x.label}</Txt>
                      <Txt v="small">{x.tagline}</Txt>
                    </View>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? c.violet : c.line} />
                  </Pressable>
                );
              })}
            </View>

            <Field
              label={role === 'OUTREACH' ? 'Who could you get us in front of?' : 'What are you best at?'}
              value={pitch}
              onChangeText={setPitch}
              multiline
              placeholder={role === 'OUTREACH' ? 'Companies or people you can already reach, and how you would open the conversation.' : 'The work you want to be hired for, and why you are good at it.'}
            />
            <Field label="Show us something" value={links} onChangeText={setLinks} autoCapitalize="none" placeholder="Up to 5 links, separated by spaces" hint="GitHub, portfolio, LinkedIn, anything you made." />
            <ErrorText>{err}</ErrorText>
            <Button label="Send application" icon="send" onPress={apply} loading={busy} />
          </Card>
        </Reveal>
      )}

      <Reveal i={3} style={{ gap: 18 }}>
        <Txt v="heading">What membership means</Txt>
        <Fact icon="briefcase-outline" title="Company briefs first" body="You see paid company work before it reaches the open board." />
        <Fact icon="ribbon-outline" title="We vouch for you" body="We put your name forward directly instead of leaving you in a pile." />
        <Fact icon="shield-checkmark-outline" title="Same escrow" body="Nothing changes about how you get paid. Money is held before you start." />
      </Reveal>
    </>
  );
}

const s = StyleSheet.create({
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  stats: { flexDirection: 'row', gap: 10 },
  caught: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  caughtIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: c.okSoft, alignItems: 'center', justifyContent: 'center' },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  needDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.orange },
  roleIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: c.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.orangeSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: c.line, borderRadius: r.lg, padding: 14, backgroundColor: c.raised },
  pickOn: { borderColor: c.violet, backgroundColor: c.violetSoft },
  stages: { flexDirection: 'row' },
  stage: { flex: 1, alignItems: 'center' },
  stageLine: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  seg: { flex: 1, height: 3, backgroundColor: 'transparent' },
  node: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.raised, borderWidth: 2, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  nodeDone: { backgroundColor: c.violet, borderColor: c.violet },
  nodeNow: { borderColor: c.orange, backgroundColor: c.orangeSoft, ...lift },
});
