import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CollegePicker } from '../components/CollegePicker';
import { ErrorText, Field } from '../components/form';
import { Button } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { isDemo, supabase } from '../lib/supabase';
import { c } from '../lib/theme';
import { checkUpi } from '../shared/upi';

const PREFERENCES = [
  'Tech & Engineering', 'Design & Creative', 'Science & Medical', 'Law & Humanities', 'Commerce & Finance',
  'Academics & Gigs', 'Errands & Manual Labor', 'Writing & Content', 'Tutoring', 'Other',
];
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Ported from saveProfile in app/profile/page.tsx. Only columns the person actually
// changed are written, never kyc_verified / kyc_status (a CHECK ties them together), and
// name, phone and college are locked for 7 days after they last changed.
export default function EditProfile() {
  const { session, reload } = useSession();
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [bio, setBio] = useState('');
  const [prefs, setPrefs] = useState<string[]>([]);
  const [upi, setUpi] = useState('');
  const [username, setUsername] = useState('');
  const [uname, setUname] = useState<'idle' | 'checking' | 'available' | 'bad'>('idle');
  const [unameMsg, setUnameMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setMe(data);
      setName(data.name ?? '');
      setPhone(data.phone ? String(data.phone) : '');
      setCollege(data.college ?? '');
      setBio(data.bio ?? '');
      setPrefs(data.preferences ?? []);
    });
  }, [session]);

  // Debounced availability check, as on the website. Only for a username not yet claimed.
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u || me?.username) return setUname('idle');
    setUname('checking');
    const t = setTimeout(async () => {
      const res = await api<{ available?: boolean; reason?: string }>(`/api/auth/check-username?u=${encodeURIComponent(u)}`, { method: 'GET' });
      if (res.data?.available) {
        setUname('available');
        setUnameMsg('');
      } else {
        setUname('bad');
        setUnameMsg(res.data?.reason ?? 'Unavailable');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, me?.username]);

  if (!me) return null;
  const last = me.profile_last_edited_at ? new Date(me.profile_last_edited_at).getTime() : null;
  const locked = last !== null && Date.now() - last < COOLDOWN_MS;
  const unlockOn = last ? new Date(last + COOLDOWN_MS).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  async function changeAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr('Photo access is needed to pick an image.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (res.canceled) return;
    const form = new FormData();
    form.append('file', { uri: res.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
    const up = await api<{ avatar_url?: string }>('/api/profile/update-avatar', { form });
    if (!up.ok) return setErr(up.error ?? 'Could not upload the photo.');
    setMe({ ...me, avatar_url: up.data.avatar_url });
    await reload();
  }

  async function save() {
    setErr('');
    if (isDemo()) return setErr('Demo mode: changes are switched off.');
    if (!locked && !name.trim()) return setErr('Name cannot be empty.');
    if (!locked && !college.trim()) return setErr('Please choose your college.');
    if (!me.upi_id && upi.trim() && !checkUpi(upi).valid) return setErr('Invalid UPI ID format (e.g. name@oksbi).');
    if (!me.username && username.trim() && uname !== 'available') return setErr(unameMsg || 'Pick an available username first.');

    const nextName = name.trim();
    const nextPhone = phone.trim();
    const identityChanged = !locked && (nextName !== String(me.name ?? '').trim() || nextPhone !== String(me.phone ?? '').trim() || (college.trim() && college.trim() !== me.college));
    const updates: Record<string, unknown> = { preferences: prefs, bio: bio.trim() || null, updated_at: new Date().toISOString() };
    if (!locked) {
      updates.name = nextName;
      updates.phone = nextPhone;
      if (college.trim()) updates.college = college.trim();
    }
    // The 7-day clock restarts only when an identity field really changed.
    if (identityChanged) updates.profile_last_edited_at = new Date().toISOString();
    if (!me.upi_id && upi.trim()) updates.upi_id = checkUpi(upi).normalized;
    if (!me.username && username.trim() && uname === 'available') updates.username = username.trim().toLowerCase();

    setBusy(true);
    const { error } = await supabase.from('users').update(updates).eq('id', me.id);
    setBusy(false);
    if (error) return setErr(error.message);
    await reload();
    Alert.alert('Saved', 'Your profile is updated.');
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Edit profile', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={changeAvatar} style={{ alignItems: 'center', gap: 6 }}>
          {me.avatar_url ? <Image source={{ uri: me.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.avatarText}>{(me.name ?? '?').charAt(0).toUpperCase()}</Text></View>}
          <Text style={s.change}>Change photo</Text>
        </Pressable>
        {locked ? <Text style={s.note}>Name, phone and college can be changed again on {unlockOn}.</Text> : null}
        <Field label="Full name" value={name} onChangeText={setName} editable={!locked} />
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!locked} />
        {locked ? <Field label="College" value={college} editable={false} /> : <CollegePicker value={college} onChange={setCollege} />}
        <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="A line about what you do" />
        <Text style={s.label}>Interests</Text>
        <View style={s.chips}>
          {PREFERENCES.map((k) => {
            const on = prefs.includes(k);
            return (
              <Pressable key={k} onPress={() => setPrefs(on ? prefs.filter((x) => x !== k) : [...prefs, k])} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, on && { color: '#fff' }]}>{k}</Text>
              </Pressable>
            );
          })}
        </View>
        {me.username ? (
          <Field label="Username" value={`@${me.username}`} editable={false} hint="Usernames cannot be changed." />
        ) : (
          <Field
            label="Claim a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            hint={uname === 'checking' ? 'Checking…' : uname === 'available' ? 'Available' : uname === 'bad' ? unameMsg : '3–20 letters, numbers or underscores. You can only claim it once.'}
          />
        )}
        {me.upi_id ? <Field label="UPI ID" value={me.upi_id} editable={false} hint="Contact support to change a saved UPI ID." /> : <Field label="UPI ID" value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="name@bank" />}
        <ErrorText>{err}</ErrorText>
        <Button label="Save changes" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarEmpty: { backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.violet, fontSize: 32, fontWeight: '700' },
  change: { color: c.violet, fontWeight: '600' },
  note: { color: c.orangeInk, backgroundColor: c.orangeSoft, padding: 10, borderRadius: 10, fontSize: 13 },
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  chipOn: { backgroundColor: c.violet },
  chipText: { color: c.violet, fontWeight: '600', fontSize: 13 },
});
