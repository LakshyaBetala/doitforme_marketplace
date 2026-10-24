import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DeadlineField } from '../../components/DeadlineField';
import { ErrorText, Field } from '../../components/form';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';
import { Picked, pickDocument, pickPhotos, uploadGigFiles } from '../../lib/upload';

// Same list and limits as app/post/page.tsx (HUSTLE listings).
const CATEGORIES = [
  'Tech & Engineering', 'Design & Creative', 'Science & Medical', 'Law & Humanities', 'Commerce & Finance',
  'Academics & Gigs', 'Errands & Manual Labor', 'Writing & Content', 'Tutoring', 'Other',
];

// Like the website, the row is inserted straight into `gigs` under RLS, after the
// server-side moderation route has looked at the text.
export default function Post() {
  const { session } = useSession();
  const [kind, setKind] = useState<'TASK' | 'SERVICE'>('TASK');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [online, setOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [github, setGithub] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const task = kind === 'TASK';
  const wantsGithub = category === 'Tech & Engineering' || category === 'Academics & Gigs';

  async function add(picker: () => Promise<Picked[] | string>) {
    const got = await picker();
    if (typeof got === 'string') return setErr(got);
    setErr('');
    setFiles((f) => [...f, ...got].slice(0, 5));
  }

  async function submit() {
    setErr('');
    const p = Number(price);
    if (!category) return setErr('Please select a category.');
    if (!title.trim()) return setErr('Please enter a title.');
    if (title.length > 80) return setErr('Title is too long (max 80 characters).');
    if (!description.trim()) return setErr('Please describe it.');
    if (description.length > 500) return setErr('Description is too long (max 500 characters).');
    if (Number.isNaN(p) || p < 1) return setErr('Please enter a valid price.');
    if (task && p < 100) return setErr('Minimum budget is ₹100.');
    if (task && !online && !location.trim()) return setErr('Location is required for in-person tasks.');
    if (deadline && deadline.getTime() <= Date.now() - 60000) return setErr('Deadline must be in the future.');
    if (isDemo()) return setErr('Demo mode: posting is switched off.');
    if (!session) return setErr('Please sign in again.');
    const uid = session.user.id;

    setBusy(true);
    // Blocks phone numbers, UPI and social handles: the main way people bypass escrow.
    const mod = await api('/api/moderation', { body: { text: `${title} ${description}` } });
    if (mod.ok && mod.data?.success === false) {
      setBusy(false);
      return setErr(mod.data?.reason ?? 'This post contains details that are not allowed.');
    }

    // A service advert is how its poster gets PAID, so it needs a payout UPI first.
    if (!task) {
      const { data: me } = await supabase.from('users').select('upi_id').eq('id', uid).maybeSingle();
      if (!me?.upi_id) {
        setBusy(false);
        return setErr('Add your UPI ID in Profile first. It is how you will get paid.');
      }
    }

    const up = await uploadGigFiles(uid, files);
    if (up.error) {
      setBusy(false);
      return setErr(up.error);
    }

    const row = {
      listing_type: task ? 'HUSTLE' : 'SERVICE',
      category,
      market_type: null,
      item_condition: null,
      poster_id: uid,
      title: title.trim(),
      description: description.trim(),
      price: p,
      security_deposit: 0,
      is_physical: task && !online,
      location: task && !online ? location.trim() || 'Campus' : null,
      images: up.paths,
      deadline: deadline ? deadline.toISOString() : null,
      github_link: wantsGithub && github.trim() ? github.trim() : null,
      status: 'open',
      is_managed: false,
      managed_status: null,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('gigs').insert(row).select('id').single();
    setBusy(false);
    if (error || !data) return setErr(error?.message ?? 'Could not post.');

    // Fire-and-forget, as on the website: alerts interested students on Telegram.
    void api('/api/telegram/broadcast', { body: { gigId: data.id, category, title: row.title, price: p, posterId: uid } });

    setCategory(''); setTitle(''); setDescription(''); setPrice(''); setLocation(''); setGithub(''); setDeadline(null); setFiles([]);
    Alert.alert(task ? 'Task posted' : 'Service posted', task ? 'Students can see it now. Applicants show up under My work → Hiring.' : 'It now appears on the Talent page.');
    router.push(`/gig/${data.id}`);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={s.chips}>
          {(['TASK', 'SERVICE'] as const).map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[s.chip, kind === k && s.chipOn]}>
              <Text style={[s.chipText, kind === k && { color: '#fff' }]}>{k === 'TASK' ? 'I need something done' : 'I offer a service'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>Category</Text>
        <View style={s.chips}>
          {CATEGORIES.map((k) => (
            <Pressable key={k} onPress={() => setCategory(k)} style={[s.chip, category === k && s.chipOn]}>
              <Text style={[s.chipText, category === k && { color: '#fff' }]}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} placeholder={task ? 'What do you need done?' : 'What do you offer?'} />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="Details, deliverables, turnaround" />
        <Field
          label={task ? 'Budget (₹)' : 'Starting price (₹)'}
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          placeholder={task ? 'Minimum 100' : 'e.g. 500'}
          hint={task ? 'You pay this into escrow. It is released when you approve the work.' : undefined}
        />
        {task ? (
          <View style={s.chips}>
            {[true, false].map((v) => (
              <Pressable key={String(v)} onPress={() => setOnline(v)} style={[s.chip, online === v && s.chipOn]}>
                <Text style={[s.chipText, online === v && { color: '#fff' }]}>{v ? 'Online' : 'In person'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {task && !online ? <Field label="Location" value={location} onChangeText={setLocation} placeholder="Campus, area or address" /> : null}
        {wantsGithub ? <Field label="GitHub link (optional)" value={github} onChangeText={setGithub} autoCapitalize="none" keyboardType="url" /> : null}
        <DeadlineField value={deadline} onChange={setDeadline} />

        <Text style={s.label}>Photos and documents ({files.length}/5)</Text>
        {files.map((f, i) => (
          <View key={f.uri} style={s.file}>
            <Text style={s.fileName} numberOfLines={1}>{f.name}</Text>
            <Text style={s.remove} onPress={() => setFiles((x) => x.filter((_, j) => j !== i))}>Remove</Text>
          </View>
        ))}
        <View style={s.chips}>
          <Button label="Add photos" variant="ghost" onPress={() => add(pickPhotos)} />
          <Button label="Add document" variant="ghost" onPress={() => add(pickDocument)} />
        </View>
        <Text style={s.hint}>Documents up to 5 MB. Photos are shrunk automatically.</Text>

        <ErrorText>{err}</ErrorText>
        <Button label={task ? 'Post task' : 'Post service'} onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  chipOn: { backgroundColor: c.violet },
  chipText: { color: c.violet, fontWeight: '600', fontSize: 13 },
  file: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: 11, padding: 12 },
  fileName: { flex: 1, color: c.ink },
  remove: { color: c.bad, fontWeight: '600', paddingLeft: 12 },
  hint: { color: c.muted, fontSize: 12 },
});
