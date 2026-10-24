import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/ui';
import { DEMO_ENABLED } from '../lib/demo';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c, r } from '../lib/theme';

// Email OTP only — magic links are disabled in Supabase (see CLAUDE.md).
export default function Login() {
  const { startDemo } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  async function verify() {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap}>
      <Text style={s.logo}>DoItForMe</Text>
      <Text style={s.tag}>Get things done. Get paid safely.</Text>
      <View style={s.card}>
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={c.darkMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!sent}
          value={email}
          onChangeText={setEmail}
        />
        {sent ? (
          <>
            <TextInput
              style={s.input}
              placeholder="6-digit code"
              placeholderTextColor={c.darkMuted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              value={code}
              onChangeText={setCode}
            />
            <Button label="Verify & sign in" onPress={verify} loading={busy} />
            <Text style={s.link} onPress={() => { setSent(false); setCode(''); }}>Use a different email</Text>
          </>
        ) : (
          <Button label="Email me a code" onPress={send} loading={busy} />
        )}
        {err ? <Text style={s.err}>{err}</Text> : null}
      </View>
      {DEMO_ENABLED ? <Button label="Try demo (sample data)" variant="ghost" onPress={startDemo} /> : null}
      <Text style={s.note}>New here? Enter your email and we will create your account.</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.darkBg, padding: 24, justifyContent: 'center' },
  logo: { color: c.darkFg, fontSize: 34, fontWeight: '700', letterSpacing: -0.7 },
  tag: { color: c.softPurple, marginTop: 6, marginBottom: 28, fontSize: 16 },
  card: { backgroundColor: c.darkCard, borderRadius: r.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: c.darkFg, borderRadius: r.md, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  link: { color: c.softPurple, textAlign: 'center', paddingVertical: 6 },
  err: { color: '#ff8a80', fontSize: 14 },
  note: { color: c.darkMuted, marginTop: 20, textAlign: 'center' },
});
