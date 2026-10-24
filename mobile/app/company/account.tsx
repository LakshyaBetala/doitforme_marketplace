import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Button, Card } from '../../components/ui';
import { api, SITE } from '../../lib/api';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

const TYPES: [string, string][] = [
  ['startup', 'Tech / Startup'],
  ['agency', 'Agency / Consulting'],
  ['enterprise', 'Corporate Enterprise'],
  ['ngo', 'Non-Profit / NGO'],
  ['other', 'Other'],
];

// Ported from app/company/profile/page.tsx: company details update under RLS on `companies`.
export default function CompanyAccount() {
  const { session, signOut } = useSession();
  const [co, setCo] = useState<any>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('startup');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const [word, setWord] = useState('');

  useEffect(() => {
    if (!session) return;
    supabase.from('companies').select('*').eq('user_id', session.user.id).single().then(({ data }) => {
      if (!data) return;
      setCo(data);
      setName(data.name ?? '');
      setWebsite(data.website ?? '');
      setEmail(data.contact_email ?? '');
      setDesc(data.description ?? '');
      setType(data.company_type ?? 'startup');
    });
  }, [session]);

  async function save() {
    setErr('');
    if (!name.trim()) return setErr('Company name cannot be empty.');
    if (isDemo()) return setErr('Demo mode: changes are switched off.');
    setBusy(true);
    const updates = { name: name.trim(), website: website.trim(), contact_email: email.trim(), description: desc.trim(), company_type: type };
    const { error } = await supabase.from('companies').update(updates).eq('id', co.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setCo({ ...co, ...updates });
    Alert.alert('Saved', 'Company profile updated.');
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await api('/api/account/delete', { body: { confirm: word } });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? 'Could not delete the account.');
    setDel(false);
    Alert.alert('Account deleted', 'Your account has been removed.');
    await signOut();
  }

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 6 }}>
        <Text style={s.h}>{co?.name ?? 'Your company'}</Text>
        <Text style={s.muted}>{session?.user.email}</Text>
        {co?.id ? <Text style={s.link} onPress={() => router.push(`/c/${co.id}`)}>View public page</Text> : null}
      </Card>

      <Field label="Company name" value={name} onChangeText={setName} />
      <Field label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
      <Field label="Contact email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="About" value={desc} onChangeText={setDesc} multiline />
      <View style={s.chips}>
        {TYPES.map(([k, l]) => (
          <Text key={k} onPress={() => setType(k)} style={[s.pickChip, type === k && s.pickOn]}>{l}</Text>
        ))}
      </View>
      <ErrorText>{err}</ErrorText>
      <Button label="Save changes" onPress={save} loading={busy} />

      <Button label="Notifications" variant="ghost" onPress={() => router.push('/notification-settings')} />
      <Button label="Terms" variant="ghost" onPress={() => Linking.openURL(`${SITE}/terms`)} />
      <Button label="Privacy policy" variant="ghost" onPress={() => Linking.openURL(`${SITE}/privacy-policy`)} />
      <Button label="Delete account" variant="ghost" onPress={() => setDel(true)} />
      <Button label="Sign out" onPress={signOut} />

      <Sheet visible={del} title="Delete your account" onClose={() => setDel(false)}>
        <Text style={s.muted}>This cannot be undone. Accounts with money in escrow or tasks in progress cannot be deleted until those finish.</Text>
        <Field label="Type DELETE to confirm" value={word} onChangeText={setWord} autoCapitalize="characters" />
        <ErrorText>{err}</ErrorText>
        <Button label="Delete my account" loading={busy} onPress={deleteAccount} />
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { color: c.inkStrong, fontSize: 20, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 14 },
  link: { color: c.violet, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickChip: { color: c.violet, backgroundColor: c.violetSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, overflow: 'hidden', fontWeight: '600', fontSize: 13 },
  pickOn: { backgroundColor: c.violet, color: '#fff' },
});
