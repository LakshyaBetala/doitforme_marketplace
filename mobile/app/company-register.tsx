import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ErrorText, Field } from '../components/form';
import { Button } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c } from '../lib/theme';
import { uploadGigFiles } from '../lib/upload';

const TYPES: [string, string][] = [
  ['startup', 'Tech / Startup'],
  ['agency', 'Agency / Consulting'],
  ['enterprise', 'Corporate Enterprise'],
  ['ngo', 'Non-Profit / NGO'],
  ['other', 'Other'],
];

// Ported from app/company/onboarding/page.tsx: details, then an emailed code, then the
// logo upload and POST /api/company/onboard (which makes the account a COMPANY and sets
// its password). Companies need admin clearance before they can post.
export default function CompanyRegister() {
  const { reload } = useSession();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('startup');
  const [password, setPassword] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr('Photo access is needed to pick a logo.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!res.canceled) setLogo(res.assets[0].uri);
  }

  async function sendCode() {
    setErr('');
    if (!name.trim() || !email.trim() || !details.trim() || !phone.trim() || !password.trim()) return setErr('Please fill in every field, including a password.');
    if (password.length < 6) return setErr('Password must be at least 6 characters.');
    if (!logo) return setErr('A company logo is required.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(error.message);
    setStep('otp');
  }

  async function finish() {
    setErr('');
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error || !data.user) {
      setBusy(false);
      return setErr(error?.message ?? 'Invalid or expired code.');
    }
    // The logo goes in the public gig-images bucket under companies/, like the website.
    let logoUrl: string | null = null;
    if (logo) {
      const up = await uploadGigFiles('companies', [{ uri: logo, name: `logo_${Date.now()}.jpg`, size: 0, mime: 'image/jpeg', isImage: true }]);
      if (up.error || !up.paths[0]) {
        setBusy(false);
        return setErr(up.error ?? 'Logo upload failed.');
      }
      logoUrl = supabase.storage.from('gig-images').getPublicUrl(up.paths[0]).data.publicUrl;
    }
    const res = await api('/api/company/onboard', {
      body: { companyName: name.trim(), companyEmail: email.trim(), companyDetails: details.trim(), companyPhone: phone.trim(), companyInterest: type, logoUrl, password: password.trim() },
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? 'Could not finish registration.');
    await reload();
    Alert.alert('Registered', 'Your company account is created. Our team verifies new companies before they can post tasks.');
    router.replace('/company');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Register your business', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {step === 'form' ? (
          <>
            <Text style={s.body}>Hire verified students. Payment is held in escrow until you approve the work.</Text>
            <Pressable onPress={pickLogo} style={s.logo}>
              {logo ? <Image source={{ uri: logo }} style={s.logoImg} /> : <Text style={s.logoText}>Add company logo</Text>}
            </Pressable>
            <Field label="Company name" value={name} onChangeText={setName} />
            <Field label="Work email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label="What does the company do?" value={details} onChangeText={setDetails} multiline />
            <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Text style={s.label}>Sector</Text>
            <Text style={s.chips}>
              {TYPES.map(([k, l]) => (
                <Text key={k} onPress={() => setType(k)} style={[s.chip, type === k && s.chipOn]}>
                  {l}
                </Text>
              ))}
            </Text>
            <Field label="Password (for signing in later)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <ErrorText>{err}</ErrorText>
            <Button label="Send verification code" onPress={sendCode} loading={busy} />
          </>
        ) : (
          <>
            <Text style={s.body}>We emailed a 6-digit code to {email}. Enter it to finish.</Text>
            <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" />
            <ErrorText>{err}</ErrorText>
            <Button label="Verify and register" onPress={finish} loading={busy} />
            <Button label="Back" variant="ghost" onPress={() => setStep('form')} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { color: c.muted, fontSize: 15, lineHeight: 22 },
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  logo: { alignSelf: 'center', width: 110, height: 110, borderRadius: 22, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 110, height: 110 },
  logoText: { color: c.violet, fontWeight: '600', textAlign: 'center', paddingHorizontal: 8 },
  chips: { lineHeight: 40 },
  chip: { color: c.violet, backgroundColor: c.violetSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontWeight: '600', fontSize: 13 },
  chipOn: { backgroundColor: c.violet, color: '#fff' },
});
