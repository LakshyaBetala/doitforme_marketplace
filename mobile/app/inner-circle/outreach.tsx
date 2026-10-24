import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { DeadlineField } from '../../components/DeadlineField';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Button, Card, Empty, Loading, Pill } from '../../components/ui';
import { rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';
import { OPEN_STAGES, OUTREACH_STAGES, OutreachStage, isOverdue, stageLabel } from '../../shared/innerCircle';

const dayLabel = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`;
};

const EMPTY = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', website: '', source: '', value_estimate: '', notes: '' };

// Ported from app/inner-circle/outreach/page.tsx. Reads and writes go to Supabase under RLS
// on purpose: is_outreach() / is_admin() and owner-only updates are enforced by the policies,
// and a route would be a second place for those rules to drift.
export default function Outreach() {
  const { session } = useSession();
  const me = session?.user.id ?? null;
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<'today' | 'mine' | 'all'>('today');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [next, setNext] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!me) return;
    const { data: p } = await supabase.from('users').select('is_elite, inner_circle_role').eq('id', me).maybeSingle();
    const ok = Boolean(p?.is_elite) && p?.inner_circle_role === 'OUTREACH';
    setAllowed(ok);
    if (!ok) return setLoading(false);
    const { data, error } = await supabase.from('outreach_leads').select('*, owner:owner_id(name)').order('next_action_at', { ascending: true, nullsFirst: false }).limit(500);
    if (error) setErr(error.message);
    setLeads(data ?? []);
    setLoading(false);
  }, [me]);

  useEffect(() => {
    void load();
  }, [load]);

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
      return setErr(/duplicate|unique/i.test(error.message) ? 'Someone on the team already has that company in the pipeline.' : error.message);
    }
    setForm(EMPTY);
    setNext(null);
    setAdding(false);
    await load();
  }

  // Optimistic, because a stage change is the most common action here.
  async function setStage(lead: any, stage: OutreachStage) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    const { error } = await supabase.from('outreach_leads').update({ stage, last_touch_at: new Date().toISOString() }).eq('id', lead.id);
    if (error) {
      setLeads(prev); // RLS refused it, almost certainly not the owner
      return setErr(error.message);
    }
    await supabase.from('outreach_touches').insert({ lead_id: lead.id, author_id: me, kind: 'stage_change', body: `${stageLabel(lead.stage)} → ${stageLabel(stage)}` });
  }

  async function claim(lead: any) {
    const { error } = await supabase.from('outreach_leads').update({ owner_id: me }).eq('id', lead.id);
    if (error) return setErr(error.message);
    await load();
  }

  const { overdue, visible } = useMemo(() => {
    const overdue = leads.filter((l) => isOverdue(l));
    const visible = filter === 'mine' ? leads.filter((l) => l.owner_id === me) : filter === 'today' ? leads.filter((l) => OPEN_STAGES.includes(l.stage) && !isOverdue(l)) : leads;
    return { overdue, visible };
  }, [leads, filter, me]);

  if (loading) return <Loading />;
  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.page, padding: 16 }}>
        <Stack.Screen options={{ headerShown: true, title: 'Outreach', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
        <Empty title="This is for Inner Circle outreach members" hint="Apply from the Inner Circle page." />
      </View>
    );
  }

  const list = filter === 'today' ? [...overdue, ...visible] : visible;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Outreach', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <FlatList
        data={list}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <View style={s.chips}>
              {(['today', 'mine', 'all'] as const).map((k) => (
                <Pressable key={k} onPress={() => setFilter(k)} style={[s.chip, filter === k && s.chipOn]}>
                  <Text style={[s.chipText, filter === k && { color: '#fff' }]}>{k === 'today' ? `To do (${overdue.length + leads.filter((l) => OPEN_STAGES.includes(l.stage) && !isOverdue(l)).length})` : k === 'mine' ? 'Mine' : 'All'}</Text>
                </Pressable>
              ))}
            </View>
            {overdue.length ? <Text style={s.overdue}>{overdue.length} overdue</Text> : null}
            <Button label="Add a lead" onPress={() => setAdding(true)} />
            <ErrorText>{err}</ErrorText>
          </View>
        }
        ListEmptyComponent={<Empty title="Nothing here" hint="Add the first company you are reaching out to." />}
        renderItem={({ item }) => (
          <Card style={{ gap: 8 }}>
            <View style={s.row}>
              <Text style={s.title} numberOfLines={2}>{item.company_name}</Text>
              {item.value_estimate ? <Text style={s.price}>{rupees(item.value_estimate)}</Text> : null}
            </View>
            <Text style={s.muted}>{[item.contact_name, item.owner?.name ? `Owner: ${item.owner.name}` : null].filter(Boolean).join(' · ')}</Text>
            <View style={s.chips}>
              {item.next_action_at ? <Pill label={`Next: ${dayLabel(item.next_action_at)}`} tone={isOverdue(item) ? 'bad' : 'neutral'} /> : null}
              <Pill label={stageLabel(item.stage)} tone={item.stage === 'won' ? 'ok' : item.stage === 'lost' ? 'bad' : 'warn'} />
            </View>
            {item.notes ? <Text style={s.muted} numberOfLines={3}>{item.notes}</Text> : null}
            <View style={s.chips}>
              {OUTREACH_STAGES.filter((st) => st.value !== item.stage).map((st) => (
                <Text key={st.value} onPress={() => setStage(item, st.value)} style={s.stage}>{st.label}</Text>
              ))}
            </View>
            <View style={s.chips}>
              {item.contact_email ? <Text style={s.link} onPress={() => Linking.openURL(`mailto:${item.contact_email}`)}>Email</Text> : null}
              {item.contact_phone ? <Text style={s.link} onPress={() => Linking.openURL(`tel:${item.contact_phone}`)}>Call</Text> : null}
              {item.website ? <Text style={s.link} onPress={() => Linking.openURL(item.website.startsWith('http') ? item.website : `https://${item.website}`)}>Website</Text> : null}
              {item.owner_id !== me ? <Text style={s.link} onPress={() => claim(item)}>Claim</Text> : null}
            </View>
          </Card>
        )}
      />

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
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 13 },
  overdue: { color: c.bad, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  chipOn: { backgroundColor: c.violet },
  chipText: { color: c.violet, fontWeight: '600', fontSize: 13 },
  stage: { color: c.violet, backgroundColor: c.violetSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '600' },
  link: { color: c.violet, fontWeight: '600' },
});
