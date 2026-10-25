import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEMO_ENABLED } from '../lib/demo';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c, r } from '../lib/theme';

type Mode = 'signin' | 'signup';
type Step = 'email' | 'code' | 'password';

const SLOW = 'Our email service is not responding right now. Please try again in a minute.';

// Turns Supabase's terse errors into something a person can act on.
function friendly(e: any, mode: Mode): string {
  const msg = String(e?.message ?? '');
  const status = Number(e?.status ?? 0);
  if (/signups? not allowed|user not found/i.test(msg)) return 'We could not find an account with that email. Tap "Sign up" to create one.';
  if (status === 429 || /rate limit|too many|seconds/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (status >= 500 || !msg || msg === '{}' || /failed to fetch|network|timed? ?out|gateway/i.test(msg)) return SLOW;
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return 'That code is wrong or has expired. Check it, or request a new one.';
  if (/invalid login/i.test(msg)) return 'Wrong email or password.';
  return mode === 'signup' && /already/i.test(msg) ? 'That email already has an account. Tap "Sign in" instead.' : msg;
}

// A request that never answers (a hung email provider surfaces as a 504 after a long wait)
// should not leave the button spinning forever.
const withTimeout = <T,>(p: Promise<T>, ms = 25000): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej({ message: 'timeout', status: 504 }), ms))]);

// Email code only (magic links are off in Supabase, see CLAUDE.md). Sign in never creates an
// account, sign up does, which is what makes the two tabs mean what they say.
export default function Login() {
  const { startDemo } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Resend cooldown, so a slow email is not answered by five more requests.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  function switchMode(m: Mode) {
    setMode(m);
    setStep('email');
    setCode('');
    setErr('');
  }

  async function sendCode() {
    if (!valid) return setErr('Enter a valid email address.');
    setBusy(true);
    setErr('');
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: mode === 'signup' } }) as Promise<{ error: any }>,
      );
      if (error) throw error;
      setStep('code');
      setWait(30);
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (e) {
      setErr(friendly(e, mode));
    }
    setBusy(false);
  }

  async function verify(token: string) {
    if (token.length < 6 || busy) return;
    setBusy(true);
    setErr('');
    try {
      const { error } = await withTimeout(supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' }) as Promise<{ error: any }>);
      if (error) throw error;
    } catch (e) {
      setErr(friendly(e, mode));
      setCode('');
    }
    setBusy(false);
  }

  // Companies sign in with the password they set at registration.
  async function passwordLogin() {
    if (!valid || !password) return setErr('Enter your email and password.');
    setBusy(true);
    setErr('');
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }) as Promise<{ error: any }>);
      if (error) throw error;
    } catch (e) {
      setErr(friendly(e, mode));
    }
    setBusy(false);
  }

  const signup = mode === 'signup';

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.brand}>
            <Image source={require('../assets/splash-icon.png')} style={s.logo} />
            <Text style={s.name}>DoItForMe</Text>
            <Text style={s.tag}>Get things done. Get paid safely.</Text>
          </View>

          {step !== 'password' ? (
            <View style={s.tabs}>
              {(['signin', 'signup'] as Mode[]).map((m) => (
                <Pressable key={m} onPress={() => switchMode(m)} style={[s.tab, mode === m && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                  <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === 'signin' ? 'Sign in' : 'Sign up'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={s.card}>
            {step === 'email' ? (
              <>
                <Text style={s.title}>{signup ? 'Create your account' : 'Welcome back'}</Text>
                <Text style={s.sub}>{signup ? 'Enter your email. We will send you a 6-digit code to confirm it.' : 'Enter the email you signed up with. We will send you a 6-digit code.'}</Text>
                <Text style={s.label}>Email</Text>
                <TextInput
                  style={s.input}
                  placeholder="you@college.edu"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={sendCode}
                  returnKeyType="go"
                />
                <Primary label={signup ? 'Create account' : 'Continue'} onPress={sendCode} busy={busy} disabled={!valid} />
              </>
            ) : null}

            {step === 'code' ? (
              <>
                <Text style={s.title}>Check your email</Text>
                <Text style={s.sub}>We sent a 6-digit code to <Text style={s.em}>{email.trim()}</Text>. It can take a minute, and check spam too.</Text>
                <TextInput
                  ref={codeRef}
                  style={[s.input, s.code]}
                  placeholder="000000"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  value={code}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, '');
                    setCode(v);
                    if (v.length === 6) void verify(v); // submit as soon as the sixth digit lands
                  }}
                />
                <Primary label={signup ? 'Verify and continue' : 'Sign in'} onPress={() => verify(code)} busy={busy} disabled={code.length < 6} />
                <View style={s.row}>
                  <Text style={s.link} onPress={() => { setStep('email'); setCode(''); setErr(''); }}>Change email</Text>
                  {wait > 0 ? <Text style={s.muted}>Resend in {wait}s</Text> : <Text style={s.link} onPress={sendCode}>Resend code</Text>}
                </View>
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <Text style={s.title}>Business sign in</Text>
                <Text style={s.sub}>Use the email and password you set when you registered your company.</Text>
                <Text style={s.label}>Work email</Text>
                <TextInput style={s.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@company.com" placeholderTextColor="rgba(255,255,255,0.35)" value={email} onChangeText={setEmail} />
                <Text style={s.label}>Password</Text>
                <TextInput style={s.input} secureTextEntry autoCapitalize="none" autoComplete="password" placeholder="Your password" placeholderTextColor="rgba(255,255,255,0.35)" value={password} onChangeText={setPassword} onSubmitEditing={passwordLogin} />
                <Primary label="Sign in" onPress={passwordLogin} busy={busy} disabled={!valid || !password} />
                <Text style={[s.link, { textAlign: 'center' }]} onPress={() => { setStep('email'); setErr(''); }}>Back to student sign in</Text>
              </>
            ) : null}

            {err ? (
              <View style={s.errBox}>
                <Text style={s.errText}>{err}</Text>
                {/no account|could not find an account/i.test(err) && mode === 'signin' ? <Text style={s.errLink} onPress={() => switchMode('signup')}>Sign up instead</Text> : null}
                {/already has an account/i.test(err) && signup ? <Text style={s.errLink} onPress={() => switchMode('signin')}>Sign in instead</Text> : null}
              </View>
            ) : null}
          </View>

          {step !== 'password' ? (
            <View style={s.footer}>
              <Text style={s.muted}>
                {signup ? 'Already have an account? ' : 'New to DoItForMe? '}
                <Text style={s.link} onPress={() => switchMode(signup ? 'signin' : 'signup')}>{signup ? 'Sign in' : 'Sign up'}</Text>
              </Text>
              <View style={s.biz}>
                <Text style={s.link} onPress={() => { setStep('password'); setErr(''); }}>Business sign in</Text>
                <Text style={s.dot}>·</Text>
                <Text style={s.link} onPress={() => router.push('/company-register')}>Register a company</Text>
              </View>
              {DEMO_ENABLED ? <Text style={[s.muted, s.demo]} onPress={startDemo}>Just looking? Try the demo with sample data</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Primary({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy: boolean; disabled?: boolean }) {
  const off = disabled || busy;
  return (
    <Pressable onPress={onPress} disabled={off} style={({ pressed }) => [s.btn, off && s.btnOff, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.darkBg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 16, justifyContent: 'center', gap: 20 },
  brand: { alignItems: 'center', gap: 4, marginBottom: 4 },
  logo: { width: 84, height: 84, borderRadius: 20, marginBottom: 8 },
  name: { color: c.darkFg, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  tag: { color: c.softPurple, fontSize: 15 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: c.brandPurple },
  tabText: { color: c.darkMuted, fontSize: 15, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: c.darkCard, borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  title: { color: c.darkFg, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: c.darkMuted, fontSize: 14, lineHeight: 20 },
  em: { color: c.darkFg, fontWeight: '700' },
  label: { color: c.darkFg, fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, color: c.darkFg, borderRadius: r.md, paddingHorizontal: 14, minHeight: 52, fontSize: 16 },
  code: { textAlign: 'center', fontSize: 28, fontWeight: '800', letterSpacing: 10, minHeight: 64 },
  btn: { minHeight: 52, borderRadius: r.md, backgroundColor: c.brandPurple, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnOff: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: c.softPurple, fontSize: 14, fontWeight: '700' },
  muted: { color: c.darkMuted, fontSize: 14 },
  errBox: { backgroundColor: 'rgba(255,99,99,0.12)', borderColor: 'rgba(255,99,99,0.35)', borderWidth: 1, borderRadius: r.md, padding: 12, gap: 6 },
  errText: { color: '#ff9b9b', fontSize: 14, lineHeight: 20 },
  errLink: { color: '#fff', fontWeight: '800', fontSize: 14 },
  footer: { alignItems: 'center', gap: 14 },
  biz: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dot: { color: c.darkMuted },
  demo: { textDecorationLine: 'underline', marginTop: 4 },
});
