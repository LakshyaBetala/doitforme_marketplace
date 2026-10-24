import * as DocumentPicker from 'expo-document-picker';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText, Field } from '../components/form';
import { Button, Pill } from '../components/ui';
import { api, signedUrlFrom } from '../lib/api';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';
import { uploadResume } from '../lib/upload';
import { checkUpi } from '../shared/upi';

// Ported from app/profile/worker-setup/page.tsx. The resume goes to the PRIVATE `resumes`
// bucket and only the bare object path is stored; reads go through /api/profile/resume.
export default function WorkerSetup() {
  const { session, reload } = useSession();
  const [skills, setSkills] = useState<string[]>([]);
  const [skillIn, setSkillIn] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [linkIn, setLinkIn] = useState('');
  const [experience, setExperience] = useState('');
  const [phone, setPhone] = useState('');
  const [upi, setUpi] = useState('');
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [newResume, setNewResume] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('skills, portfolio_links, experience, resume_url, phone, upi_id').eq('id', session.user.id).single().then(({ data }) => {
      if (!data) return;
      setSkills(data.skills ?? []);
      setLinks(data.portfolio_links ?? []);
      setExperience(data.experience ?? '');
      setResumePath(data.resume_url ?? null);
      setPhone(data.phone ? String(data.phone) : '');
      setUpi(data.upi_id ?? '');
    });
  }, [session]);

  async function pickResume() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if ((a.size ?? 0) > 2 * 1024 * 1024) return setErr('Resume must be less than 2MB.');
    setErr('');
    setNewResume({ uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/pdf' });
  }

  async function viewResume() {
    const url = await signedUrlFrom('/api/profile/resume');
    if (url) Linking.openURL(url);
    else Alert.alert('Could not open resume', 'Try again in a moment.');
  }

  async function save() {
    setErr('');
    if (!phone.trim()) return setErr('Phone number is required to apply.');
    if (skills.length === 0 && !resumePath && !newResume) return setErr('Add at least one skill or upload a resume.');
    if (upi.trim() && !checkUpi(upi).valid) return setErr('Invalid UPI ID format (e.g. name@oksbi).');
    if (!session) return;

    setBusy(true);
    let path = resumePath;
    if (newResume) {
      const up = await uploadResume(session.user.id, { ...newResume, size: 0, isImage: false });
      if (up.error) {
        setBusy(false);
        return setErr(up.error);
      }
      path = up.path ?? null;
    }
    const res = await api('/api/profile/worker-setup', {
      body: { skills, portfolio_links: links, experience, phone: phone.trim(), upi_id: upi.trim(), resume_url: path || undefined },
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? 'Could not save.');
    await reload();
    Alert.alert('Saved', 'Your worker profile is updated.');
    router.back();
  }

  const chips = (list: string[], set: (v: string[]) => void) => (
    <View style={s.chips}>
      {list.map((x) => (
        <Text key={x} style={s.chip} onPress={() => set(list.filter((y) => y !== x))}>
          {x}  ✕
        </Text>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Worker profile', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={s.body}>Posters see this when you apply. Add at least one skill or a resume.</Text>

        <Field label={`Skills (${skills.length}/3)`} value={skillIn} onChangeText={setSkillIn} placeholder="e.g. React, Logo design" editable={skills.length < 3} />
        <Button label="Add skill" variant="ghost" onPress={() => { if (skillIn.trim() && skills.length < 3) { setSkills([...skills, skillIn.trim()]); setSkillIn(''); } }} />
        {chips(skills, setSkills)}

        <Field label={`Portfolio links (${links.length}/3)`} value={linkIn} onChangeText={setLinkIn} autoCapitalize="none" keyboardType="url" placeholder="https://github.com/…" editable={links.length < 3} />
        <Button label="Add link" variant="ghost" onPress={() => { if (linkIn.trim() && links.length < 3) { setLinks([...links, linkIn.trim()]); setLinkIn(''); } }} />
        {chips(links, setLinks)}

        <Field label="Experience" value={experience} onChangeText={setExperience} multiline maxLength={500} />
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="UPI ID (optional)" value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="name@bank" />

        <Text style={s.label}>Resume</Text>
        {newResume ? <Pill label={`New: ${newResume.name}`} /> : resumePath ? <Pill label="Resume uploaded" tone="ok" /> : <Text style={s.muted}>No resume yet</Text>}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button label={resumePath || newResume ? 'Replace resume' : 'Upload resume'} variant="ghost" onPress={pickResume} />
          {resumePath && !newResume ? <Button label="View" variant="ghost" onPress={viewResume} /> : null}
        </View>
        <Text style={s.muted}>PDF or Word, under 2 MB. Only posters you apply to can see it.</Text>

        <ErrorText>{err}</ErrorText>
        <Button label="Save" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { color: c.muted, fontSize: 15, lineHeight: 22 },
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  muted: { color: c.muted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { color: c.violet, backgroundColor: c.violetSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontWeight: '600' },
});
