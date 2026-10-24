import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { CollegePicker } from '../components/CollegePicker';
import { ErrorText, Field } from '../components/form';
import { Button } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { c } from '../lib/theme';

// Same save as app/onboarding/page.tsx: POST /api/auth/create-user, which upserts the
// users row (and wallet) with the service role. Phone and college are the gate the
// website enforces in app/dashboard/layout.tsx.
export default function FinishProfile() {
  const { session, profile, reload, signOut } = useSession();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [college, setCollege] = useState(profile?.college ?? '');
  const [upi, setUpi] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!name.trim() || !phone.trim() || !college.trim()) return setErr('Name, phone and college are required.');
    setBusy(true);
    setErr('');
    const res = await api('/api/auth/create-user', {
      body: {
        email: session?.user.email,
        name: name.trim(),
        phone: phone.trim(),
        college: college.trim(),
        upi_id: upi.trim() || undefined,
      },
    });
    if (!res.ok) {
      setBusy(false);
      return setErr(res.error ?? 'Could not save.');
    }
    // Same follow-up call as app/auth/callback: a referral code is applied once the row exists.
    if (ref.trim()) await api('/api/referral/apply', { body: { referralCode: ref.trim() } });
    setBusy(false);
    await reload();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Finish your profile</Text>
        <Text style={s.body}>A few details so posters know who they are hiring and where to pay you.</Text>
        <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" hint="Kept private. Never shown to other users." />
        <CollegePicker value={college} onChange={setCollege} />
        <Field label="Referral code (optional)" value={ref} onChangeText={setRef} autoCapitalize="characters" />
        <Field label="UPI ID (optional)" value={upi} onChangeText={setUpi} autoCapitalize="none" hint="You can add this later, when you deliver your first task." />
        <ErrorText>{err}</ErrorText>
        <Button label="Save and continue" onPress={save} loading={busy} />
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, gap: 14, paddingTop: 56 },
  title: { color: c.inkStrong, fontSize: 26, fontWeight: '700' },
  body: { color: c.muted, fontSize: 16, lineHeight: 22 },
});
