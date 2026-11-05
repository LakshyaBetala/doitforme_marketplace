import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { DeadlineField } from '../../components/DeadlineField';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Reveal, ScreenHeader, Segmented, Stat } from '../../components/ic/kit';
import { Txt } from '../../components/ic/Txt';
import { Button, Card, Empty, Loading, Pill } from '../../components/ui';
import { rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { isAdminEmail } from '../../shared/admins';
import { c, lift } from '../../lib/theme';
import { OPEN_STAGES, OUTREACH_STAGES, OutreachStage, isOverdue, stageLabel } from '../../shared/innerCircle';

const dayLabel = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`;
};

const STAGE_COLOR: Record<string, string> = { new: c.faint, contacted: c.violet, replied: c.orange, meeting: c.orangeInk, won: c.ok, lost: c.bad };

// Postgres errors are for us, not for the person tapping a button.
function leadError(e: { message?: string; code?: string } | null): string {
  const m = String(e?.message ?? '');
  if (/outreach_won_has_value/.test(m)) return 'A won lead needs the amount it closed at.';
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(m)) return 'Only the person who owns this lead can change it. Claim it first if it is unowned.';
  if (/duplicate|unique/i.test(m)) return 'Someone on the team already has that company in the pipeline.';
  return m || 'That did not save. Try again.';
}

const EMPTY = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', website: '', source: '', value_estimate: '', notes: '' };

// Reads and writes go to Supabase under RLS on purpose: is_outreach() / is_admin() and owner-only
// updates are enforced by the policies, and a route would be a second place for those rules to drift.
export default function Pipeline() {
  const { session, profile } = useSession();
  const me = session?.user.id ?? null;
  // Admins pass too: RLS allows is_admin() on every outreach read and write.
  const allowed = (Boolean(profile?.is_elite) && profile?.inner_circle_role === 'OUTREACH') || isAdminEmail(session?.user.email);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<'today' | 'mine' | 'all'>('today');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [next, setNext] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // The lead being marked won, while we ask what it closed at.
  const [winning, setWinning] = useState<any>(null);
  const [wonValue, setWonValue] = useState('');

  const load = useCallback(async () => {
    if (!me || !allowed) return setLoading(false);
    const { data, error } = await supabase.from('outreach_leads').select('*, owner:owner_id(name)').order('next_action_at', { ascending: true, nullsFirst: false }).limit(500);
    if (error) setErr(error.message);
    setLeads(data ?? []);
    setLoading(false);
  }, [me, allowed]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function addLead() {
    if (!form.company_name.trim()) return setErr('A company name is the one thing we need.');
    if (isDemo()) return setErr('Demo mode: changes are switched off.');
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('outreach_leads').insert({
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      website: form.website.trim() || null,
      source: form.source.trim() || null,
      // "" would become 0, and a budget of zero rupees is a claim, not a blank.
      value_estimate: form.value_estimate.trim() ? Number(form.value_estimate) : null,
      notes: form.notes.trim() || null,
      next_action_at: next ? next.toISOString() : null,
      owner_id: me,
      created_by: me,
    });
    setBusy(false);
    if (error) {
      // The unique index on lower(btrim(company_name)) is doing its job here.
      return setErr(leadError(error));
    }
    setForm(EMPTY);
    setNext(null);
    setAdding(false);
    await load();
  }

  // Optimistic, because a stage change is the most common action here.
  async function setStage(lead: any, stage: OutreachStage) {
    // Won needs the closed value first. The database refuses a won lead without one
    // (outreach_won_has_value), because commission is computed from it; asking here is the
    // only way the pipeline can ever reach its last step.
    if (stage === 'won' && lead.stage !== 'won') {
      setErr('');
      setWonValue(lead.value_estimate ? String(lead.value_estimate) : '');
      return setWinning(lead);
    }
    void Haptics.selectionAsync().catch(() => {});
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    const { error } = await supabase.from('outreach_leads').update({ stage, last_touch_at: new Date().toISOString() }).eq('id', lead.id);
    if (error) {
      setLeads(prev); // RLS refused it, almost certainly not the owner
      return setErr(leadError(error));
    }
    await supabase.from('outreach_touches').insert({ lead_id: lead.id, author_id: me, kind: 'stage_change', body: `${stageLabel(lead.stage)} → ${stageLabel(stage)}` });
  }

  async function confirmWon() {
    if (!winning) return;
    if (isDemo()) return setErr('Demo mode: changes are switched off.');
    const value = Math.round(Number(wonValue.replace(/[^0-9.]/g, '')));
    if (!Number.isFinite(value) || value <= 0) return setErr('Enter the amount the deal closed at, in rupees.');
    setBusy(true);
    setErr('');
    const { error } = await supabase
      .from('outreach_leads')
      .update({ stage: 'won', won_value: value, last_touch_at: new Date().toISOString() })
      .eq('id', winning.id);
    setBusy(false);
    if (error) return setErr(leadError(error));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await supabase.from('outreach_touches').insert({
      lead_id: winning.id,
      author_id: me,
      kind: 'stage_change',
      body: `${stageLabel(winning.stage)} → ${stageLabel('won')} at ${rupees(value)}`,
    });
    setWinning(null);
    await load();
  }

  async function claim(lead: any) {
    const { error } = await supabase.from('outreach_leads').update({ owner_id: me }).eq('id', lead.id);
    if (error) return setErr(leadError(error));
    await load();
  }

  const { overdue, todo, visible, won, open } = useMemo(() => {
    const overdue = leads.filter((l) => isOverdue(l));
    const todo = leads.filter((l) => OPEN_STAGES.includes(l.stage) && !isOverdue(l));
    const visible = filter === 'mine' ? leads.filter((l) => l.owner_id === me) : filter === 'today' ? [...overdue, ...todo] : leads;
    return { overdue, todo, visible, won: leads.filter((l) => l.stage === 'won').length, open: leads.filter((l) => OPEN_STAGES.includes(l.stage)).length };
  }, [leads, filter, me]);

  if (loading) return <Loading />;
  if (!allowed) {
    return (
      <View style={s.page}>
        <ScreenHeader eyebrow="The Inner Circle" title="Pipeline" />
        <View style={{ padding: 20 }}>
          <Empty icon="lock-closed-outline" title="This is for outreach members" hint="Ask to join the Inner Circle from the Circle tab." />
          <Button label="About the Inner Circle" variant="ghost" onPress={() => router.replace('/inner-circle')} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <FlatList
        data={visible}
        keyExtractor={(l) => l.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.violet} />}
        ListHeaderComponent={
          <View>
            <ScreenHeader eyebrow="The Inner Circle" title="Pipeline" subtitle="Companies you are bringing in. Keep a next action on every open lead." />
            <View style={{ padding: 20, paddingBottom: 6, gap: 14 }}>
              <Reveal i={0} style={{ flexDirection: 'row', gap: 10 }}>
                <Stat label="Open leads" value={open} />
                <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'bad' : 'ink'} />
                <Stat label="Won" value={won} tone="ok" />
              </Reveal>
              <Segmented
                value={filter}
                onChange={setFilter}
                items={[
                  { key: 'today', label: 'To do', count: overdue.length + todo.length },
                  { key: 'mine', label: 'Mine' },
                  { key: 'all', label: 'All' },
                ]}
              />
              <ErrorText>{err}</ErrorText>
            </View>
          </View>
        }
        ListEmptyComponent={<Empty icon="paper-plane-outline" title="Nothing here" hint="Add the first company you are reaching out to." />}
        renderItem={({ item, index }) => {
          const late = isOverdue(item);
          const tint = STAGE_COLOR[item.stage] ?? c.faint;
          return (
            <Reveal i={Math.min(index, 6)} style={{ paddingHorizontal: 20, marginTop: 12 }}>
              <Card style={s.lead}>
                <View style={[s.bar, { backgroundColor: tint }]} />
                <View style={{ flex: 1, gap: 10 }}>
                  <View style={s.rowBetween}>
                    <Txt v="heading" numberOfLines={2} style={{ flex: 1, fontSize: 17 }}>{item.company_name}</Txt>
                    {item.value_estimate ? <Txt v="num" style={{ fontSize: 17, color: c.violet }}>{rupees(item.value_estimate)}</Txt> : null}
                  </View>
                  {[item.contact_name, item.owner?.name ? `Owner: ${item.owner.name}` : null].filter(Boolean).length ? (
                    <Txt v="small">{[item.contact_name, item.owner?.name ? `Owner: ${item.owner.name}` : null].filter(Boolean).join(' · ')}</Txt>
                  ) : null}
                  <View style={s.chips}>
                    <Pill label={stageLabel(item.stage)} tone={item.stage === 'won' ? 'ok' : item.stage === 'lost' ? 'bad' : 'warn'} />
                    {item.next_action_at ? <Pill label={`Next: ${dayLabel(item.next_action_at)}`} tone={late ? 'bad' : 'neutral'} /> : null}
                  </View>
                  {item.notes ? <Txt v="small" numberOfLines={3}>{item.notes}</Txt> : null}

                  <View>
                    <Txt v="caption" style={{ marginBottom: 6 }}>Move to</Txt>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {OUTREACH_STAGES.filter((st) => st.value !== item.stage).map((st) => (
                        <Pressable key={st.value} onPress={() => setStage(item, st.value)} style={s.move}>
                          <View style={[s.moveDot, { backgroundColor: STAGE_COLOR[st.value] }]} />
                          <Txt v="small" style={{ color: c.inkStrong, fontWeight: '600', fontSize: 13 }}>{st.label}</Txt>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={s.actions}>
                    {item.contact_email ? <Act icon="mail-outline" label="Email" onPress={() => Linking.openURL(`mailto:${item.contact_email}`)} /> : null}
                    {item.contact_phone ? <Act icon="call-outline" label="Call" onPress={() => Linking.openURL(`tel:${item.contact_phone}`)} /> : null}
                    {item.website ? <Act icon="globe-outline" label="Website" onPress={() => Linking.openURL(item.website.startsWith('http') ? item.website : `https://${item.website}`)} /> : null}
                    {item.owner_id !== me ? <Act icon="hand-left-outline" label="Claim" onPress={() => claim(item)} /> : null}
                  </View>
                </View>
              </Card>
            </Reveal>
          );
        }}
      />

      <Pressable onPress={() => setAdding(true)} style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityLabel="Add a lead">
        <Ionicons name="add" size={22} color="#371448" />
        <Txt v="body" style={{ color: '#371448', fontWeight: '700' }}>Add lead</Txt>
      </Pressable>

      <Sheet visible={adding} title="Add a lead" onClose={() => setAdding(false)}>
        <Field label="Company name" value={form.company_name} onChangeText={(v) => setForm({ ...form, company_name: v })} />
        <Field label="Contact name" value={form.contact_name} onChangeText={(v) => setForm({ ...form, contact_name: v })} />
        <Field label="Contact email" value={form.contact_email} onChangeText={(v) => setForm({ ...form, contact_email: v })} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Contact phone" value={form.contact_phone} onChangeText={(v) => setForm({ ...form, contact_phone: v })} keyboardType="phone-pad" />
        <Field label="Website" value={form.website} onChangeText={(v) => setForm({ ...form, website: v })} autoCapitalize="none" />
        <Field label="Where did you find them?" value={form.source} onChangeText={(v) => setForm({ ...form, source: v })} />
        <Field label="Estimated value (₹)" value={form.value_estimate} onChangeText={(v) => setForm({ ...form, value_estimate: v })} keyboardType="number-pad" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
        <DeadlineField value={next} onChange={setNext} />
        <ErrorText>{err}</ErrorText>
        <Button label="Save lead" onPress={addLead} loading={busy} />
      </Sheet>

      <Sheet visible={Boolean(winning)} title="Mark as won" onClose={() => setWinning(null)}>
        <Field
          label="What did it close at? (₹)"
          hint={winning?.company_name ? `The signed amount for ${winning.company_name}. Commission is worked out from this.` : undefined}
          value={wonValue}
          onChangeText={setWonValue}
          keyboardType="number-pad"
        />
        <ErrorText>{err}</ErrorText>
        <Button label="Mark as won" onPress={confirmWon} loading={busy} />
      </Sheet>
    </View>
  );
}

function Act({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.act} accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color={c.violet} />
      <Txt v="small" style={{ color: c.violet, fontWeight: '700', fontSize: 13 }}>{label}</Txt>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.page },
  lead: { flexDirection: 'row', gap: 14, padding: 16, overflow: 'hidden' },
  bar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  move: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  moveDot: { width: 7, height: 7, borderRadius: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: c.line },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingRight: 12 },
  fab: { position: 'absolute', right: 20, bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.orange, borderRadius: 999, paddingHorizontal: 18, minHeight: 52, ...lift, shadowOpacity: 0.22 },
});
