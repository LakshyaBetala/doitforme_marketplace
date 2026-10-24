import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { DeadlineField } from '../../components/DeadlineField';
import { ErrorText, Field } from '../../components/form';
import { Button, Card, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';
import { Picked, pickDocument, pickPhotos, uploadGigFiles } from '../../lib/upload';

// Same fields and rules as app/company/post/page.tsx. Managed delivery is a company-only
// offering (we assign a vetted student and QA the work), which is why it lives here.
const CATEGORIES = [
  'Tech & Engineering', 'Design & Creative', 'Science & Medical', 'Law & Humanities', 'Commerce & Finance',
  'Academics & Gigs', 'Data & Research', 'Writing & Content', 'Marketing & PR', 'Other',
];

export default function CompanyPost() {
  const { session } = useSession();
  const [ready, setReady] = useState(false);
  const [gate, setGate] = useState<'ok' | 'unverified' | 'limit'>('ok');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  const [category, setCategory] = useState('Other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [workers, setWorkers] = useState('1');
  const [managed, setManaged] = useState(false);
  const [online, setOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!session) return;
    (async () => {
      const uid = session.user.id;
      const [u, co] = await Promise.all([
        supabase.from('users').select('role, is_verified_company').eq('id', uid).single(),
        supabase.from('companies').select('id, pro_until, lifetime_gigs_posted').eq('user_id', uid).single(),
      ]);
      const pro = !!(co.data?.pro_until && new Date(co.data.pro_until) > new Date());
      setIsPro(pro);
      setCompanyId(co.data?.id ?? null);
      // Free tier: 1 lifetime task. Pro: unlimited.
      if (!u.data?.is_verified_company) setGate('unverified');
      else if (!pro && (co.data?.lifetime_gigs_posted ?? 0) >= 1) setGate('limit');
      setReady(true);
    })();
  }, [session]);

  async function add(picker: () => Promise<Picked[] | string>) {
    const got = await picker();
    if (typeof got === 'string') return setErr(got);
    setErr('');
    setFiles((f) => [...f, ...got].slice(0, 5));
  }

  async function submit() {
    setErr('');
    const p = Number(price);
    const w = Number(workers);
    if (!title.trim() || !description.trim() || !price || !category) return setErr('Please fill in all required fields.');
    if (!Number.isInteger(w) || w < 1 || w > 50) return setErr('Required workers must be between 1 and 50.');
    if (Number.isNaN(p) || p < 100) return setErr('Minimum budget per worker is ₹100.');
    if (!online && !location.trim()) return setErr('Location is required for in-person tasks.');
    if (deadline && deadline.getTime() <= Date.now() - 60000) return setErr('Deadline must be in the future.');
    if (isDemo()) return setErr('Demo mode: posting is switched off.');
    if (!session) return;
    const uid = session.user.id;

    setBusy(true);
    const mod = await api('/api/moderation', { body: { text: `${title} ${description}` } });
    if (mod.ok && mod.data?.success === false) {
      setBusy(false);
      return setErr(mod.data?.reason ?? 'This post contains details that are not allowed.');
    }
    const up = await uploadGigFiles(uid, files);
    if (up.error) {
      setBusy(false);
      return setErr(up.error);
    }

    const row = {
      listing_type: 'COMPANY_TASK',
      category,
      poster_id: uid,
      company_id: companyId,
      title: title.trim(),
      description: description.trim(),
      price: p,
      max_workers: w,
      is_managed: managed,
      managed_status: managed ? 'UNASSIGNED' : null,
      is_physical: !online,
      location: online ? null : location.trim(),
      images: up.paths,
      deadline: deadline ? deadline.toISOString() : null,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('gigs').insert(row).select('id').single();
    if (error || !data) {
      setBusy(false);
      return setErr(error?.message ?? 'Could not post the task.');
    }

    // Bookkeeping, non-fatal like on the website: Pro tasks are featured, and the free-tier
    // counter ticks up.
    try {
      if (isPro) await supabase.from('gigs').update({ is_featured: true }).eq('id', data.id);
      const rpc = await supabase.rpc('increment_company_lifetime_gigs', { p_user_id: uid });
      if (rpc.error) {
        const { data: co } = await supabase.from('companies').select('lifetime_gigs_posted').eq('user_id', uid).single();
        await supabase.from('companies').update({ lifetime_gigs_posted: (co?.lifetime_gigs_posted ?? 0) + 1 }).eq('user_id', uid);
      }
    } catch {
      /* non-fatal */
    }
    setBusy(false);
    Alert.alert('Task posted', 'Verified students can now apply.');
    router.replace(`/gig/${data.id}`);
  }

  if (!ready) return <Loading />;
  if (gate !== 'ok') {
    return (
      <View style={{ flex: 1, backgroundColor: c.page, padding: 16 }}>
        <Card style={{ gap: 8 }}>
          <Text style={s.h}>{gate === 'unverified' ? 'Awaiting verification' : 'Free plan limit reached'}</Text>
          <Text style={s.body}>
            {gate === 'unverified'
              ? 'Only verified companies can post tasks. Our team will email you once your account is cleared.'
              : 'The free plan includes 1 task. Upgrade to Pro from the Dashboard to post more.'}
          </Text>
          <Button label="Back to dashboard" variant="ghost" onPress={() => router.replace('/company')} />
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Category</Text>
        <View style={s.chips}>
          {CATEGORIES.map((k) => (
            <Pressable key={k} onPress={() => setCategory(k)} style={[s.chip, category === k && s.chipOn]}>
              <Text style={[s.chipText, category === k && { color: '#fff' }]}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={500} multiline />
        <Field label="Budget per worker (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="Minimum 100" hint="Held in escrow when you hire, plus a small payment fee." />
        <Field label="Workers needed" value={workers} onChangeText={setWorkers} keyboardType="number-pad" />
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Managed delivery</Text>
            <Text style={s.hint}>We assign a vetted student and check the work for you.</Text>
          </View>
          <Switch value={managed} onValueChange={setManaged} trackColor={{ true: c.violet }} />
        </View>
        <View style={s.chips}>
          {[true, false].map((v) => (
            <Pressable key={String(v)} onPress={() => setOnline(v)} style={[s.chip, online === v && s.chipOn]}>
              <Text style={[s.chipText, online === v && { color: '#fff' }]}>{v ? 'Online' : 'In person'}</Text>
            </Pressable>
          ))}
        </View>
        {!online ? <Field label="Location" value={location} onChangeText={setLocation} /> : null}
        <DeadlineField value={deadline} onChange={setDeadline} />

        <Text style={s.label}>Attachments ({files.length}/5)</Text>
        {files.map((f, i) => (
          <View key={f.uri} style={s.file}>
            <Text style={{ flex: 1, color: c.ink }} numberOfLines={1}>{f.name}</Text>
            <Text style={{ color: c.bad, fontWeight: '600' }} onPress={() => setFiles((x) => x.filter((_, j) => j !== i))}>Remove</Text>
          </View>
        ))}
        <View style={s.chips}>
          <Button label="Add photos" variant="ghost" onPress={() => add(pickPhotos)} />
          <Button label="Add document" variant="ghost" onPress={() => add(pickDocument)} />
        </View>

        <ErrorText>{err}</ErrorText>
        <Button label="Post company task" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  h: { color: c.inkStrong, fontSize: 17, fontWeight: '700' },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  hint: { color: c.muted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  chipOn: { backgroundColor: c.violet },
  chipText: { color: c.violet, fontWeight: '600', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: 11, padding: 12 },
  file: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: 11, padding: 12, gap: 12 },
});
