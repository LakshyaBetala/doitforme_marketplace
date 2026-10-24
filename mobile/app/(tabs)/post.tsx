import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText, Field } from '../../components/form';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { isDemo, supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { c } from '../../lib/theme';

// Same list and limits as app/post/page.tsx (HUSTLE listings).
const CATEGORIES = [
  'Tech & Engineering', 'Design & Creative', 'Science & Medical', 'Law & Humanities', 'Commerce & Finance',
  'Academics & Gigs', 'Errands & Manual Labor', 'Writing & Content', 'Tutoring', 'Other',
];

// Task posting only: no photos and no service adverts yet. Like the website, the row is
// inserted straight into `gigs` under RLS; the server-side moderation route runs first.
export default function Post() {
  const { session } = useSession();
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [online, setOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    const p = Number(price);
    if (!category) return setErr('Please select a category.');
    if (!title.trim()) return setErr('Please enter a title.');
    if (title.length > 80) return setErr('Title is too long (max 80 characters).');
    if (!description.trim()) return setErr('Please describe the task.');
    if (description.length > 500) return setErr('Description is too long (max 500 characters).');
    if (Number.isNaN(p) || p < 100) return setErr('Minimum budget is ₹100.');
    if (!online && !location.trim()) return setErr('Location is required for offline tasks.');
    if (isDemo()) return setErr('Demo mode: posting is switched off.');
    if (!session) return setErr('Please sign in again.');

    setBusy(true);
    // Blocks phone numbers, UPI and social handles: the main way people bypass escrow.
    const mod = await api('/api/moderation', { body: { text: `${title} ${description}` } });
    if (mod.ok && mod.data?.success === false) {
      setBusy(false);
      return setErr(mod.data?.reason ?? 'This post contains details that are not allowed.');
    }

    const row = {
      listing_type: 'HUSTLE',
      category,
      market_type: null,
      item_condition: null,
      poster_id: session.user.id,
      title: title.trim(),
      description: description.trim(),
      price: p,
      security_deposit: 0,
      is_physical: !online,
      location: online ? null : location.trim() || 'Campus',
      images: [],
      deadline: null,
      github_link: null,
      status: 'open',
      is_managed: false,
      managed_status: null,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('gigs').insert(row).select('id').single();
    setBusy(false);
    if (error || !data) return setErr(error?.message ?? 'Could not post the task.');

    // Fire-and-forget, as on the website: alerts interested students on Telegram.
    void api('/api/telegram/broadcast', { body: { gigId: data.id, category, title: row.title, price: p, posterId: row.poster_id } });

    setCategory(''); setTitle(''); setDescription(''); setPrice(''); setLocation('');
    Alert.alert('Task posted', 'Students can see it now. Applicants will show up under My work → Hiring.');
    router.push(`/gig/${data.id}`);
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
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} placeholder="What do you need done?" />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="Details, deliverables, deadline" />
        <Field label="Budget (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="Minimum 100" hint="You pay this into escrow. It is released when you approve the work." />
        <View style={s.chips}>
          {[true, false].map((v) => (
            <Pressable key={String(v)} onPress={() => setOnline(v)} style={[s.chip, online === v && s.chipOn]}>
              <Text style={[s.chipText, online === v && { color: '#fff' }]}>{v ? 'Online' : 'In person'}</Text>
            </Pressable>
          ))}
        </View>
        {!online ? <Field label="Location" value={location} onChangeText={setLocation} placeholder="Campus, area or address" /> : null}
        <ErrorText>{err}</ErrorText>
        <Button label="Post task" onPress={submit} loading={busy} />
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
});
