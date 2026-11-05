import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Reveal } from '../components/ic/kit';
import { Txt } from '../components/ic/Txt';
import { Button } from '../components/ui';
import { INNER_CIRCLE_ONLY } from '../lib/config';
import { DEMO_ENABLED } from '../lib/demo';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { c, font, grape, lift, r } from '../lib/theme';

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
  const params = useLocalSearchParams<{ mode?: string }>();
  const { top } = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const [focus, setFocus] = useState(false);
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

  // Password sign-in. In the full app this is for companies; in the Inner Circle build it is
  // for anyone who has a password, which is every account created with email on the website.
  // It is also the way in that does not depend on Supabase sending an email, so it keeps
  // working when the code email does not arrive.
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
    <View style={s.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={grape.colors} start={grape.start} end={grape.end} style={[s.top, { paddingTop: top + 12 }]}>
            <View pointerEvents="none" style={s.orbA} />
            <View pointerEvents="none" style={s.orbB} />
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} hitSlop={12} style={s.back} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Reveal i={0}>
              <Image source={require('../assets/splash-icon.png')} style={s.logo} resizeMode="contain" />
              <Txt v="eyebrow" style={{ color: grape.gold, marginTop: 14 }}>The Inner Circle</Txt>
              <Txt v="title" style={{ color: '#fff', marginTop: 6, fontSize: 30, lineHeight: 34 }}>
                {step === 'code' ? 'Check your email' : step === 'password' ? (INNER_CIRCLE_ONLY ? 'Sign in with password' : 'Business sign in') : signup ? 'Apply to join' : 'Welcome back'}
              </Txt>
            </Reveal>
          </LinearGradient>

          <View style={s.sheet}>
            {step !== 'password' ? (
              <View style={s.tabs}>
                {(['signin', 'signup'] as Mode[]).map((m) => (
                  <Pressable key={m} onPress={() => switchMode(m)} style={[s.tab, mode === m && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                    <Txt v="small" style={{ color: mode === m ? '#fff' : c.muted, fontWeight: '700', fontSize: 14.5 }}>{m === 'signin' ? 'Sign in' : 'Sign up'}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {step === 'email' ? (
              <View style={{ gap: 14 }}>
                <Txt v="small" style={{ fontSize: 14.5, lineHeight: 22 }}>
                  {signup ? 'Create your account with your email. We will send a 6-digit code to confirm it, then you can ask to join.' : 'Enter the email you signed up with. We will send you a 6-digit code.'}
                </Txt>
                <View style={{ gap: 6 }}>
                  <Txt v="small" style={{ color: c.inkStrong, fontWeight: '700' }}>Email</Txt>
                  <TextInput
                    style={[s.input, focus && s.inputFocus]}
                    placeholder="you@college.edu"
                    placeholderTextColor={c.faint}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    onSubmitEditing={sendCode}
                    returnKeyType="go"
                  />
                </View>
                <Button label={signup ? 'Create account' : 'Continue'} icon="arrow-forward" onPress={sendCode} loading={busy} disabled={!valid} />
              </View>
            ) : null}

            {step === 'code' ? (
              <View style={{ gap: 16 }}>
                <Txt v="small" style={{ fontSize: 14.5, lineHeight: 22 }}>
                  We sent a 6-digit code to <Txt v="small" style={{ color: c.inkStrong, fontWeight: '700' }}>{email.trim()}</Txt>. It can take a minute, and check spam too.
                </Txt>
                {/* Six boxes drawn over one hidden input, so autofill and paste still work. */}
                <Pressable onPress={() => codeRef.current?.focus()} style={s.boxes}>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const active = i === code.length && !busy;
                    return (
                      <View key={i} style={[s.box, code[i] && s.boxFilled, active && s.boxActive]}>
                        <Txt v="num" style={{ fontSize: 24 }}>{code[i] ?? ''}</Txt>
                      </View>
                    );
                  })}
                  <TextInput
                    ref={codeRef}
                    style={s.hidden}
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
                </Pressable>
                <Button label={signup ? 'Verify and continue' : 'Sign in'} onPress={() => verify(code)} loading={busy} disabled={code.length < 6} />
                <View style={s.row}>
                  <Txt v="small" style={s.link} onPress={() => { setStep('email'); setCode(''); setErr(''); }}>Change email</Txt>
                  {wait > 0 ? <Txt v="small">Resend in {wait}s</Txt> : <Txt v="small" style={s.link} onPress={sendCode}>Resend code</Txt>}
                </View>
              </View>
            ) : null}

            {step === 'password' ? (
              <View style={{ gap: 14 }}>
                <Txt v="small">
                  {INNER_CIRCLE_ONLY
                    ? 'Use the email and password you sign in with on the DoItForMe website. Joined with Google? You will not have a password, so use the email code instead.'
                    : 'Use the email and password you set when you registered your company.'}
                </Txt>
                <TextInput style={s.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder={INNER_CIRCLE_ONLY ? 'you@example.com' : 'you@company.com'} placeholderTextColor={c.faint} value={email} onChangeText={setEmail} />
                <TextInput style={s.input} secureTextEntry autoCapitalize="none" autoComplete="password" placeholder="Your password" placeholderTextColor={c.faint} value={password} onChangeText={setPassword} onSubmitEditing={passwordLogin} />
                <Button label="Sign in" onPress={passwordLogin} loading={busy} disabled={!valid || !password} />
                <Txt v="small" style={[s.link, { textAlign: 'center' }]} onPress={() => { setStep('email'); setErr(''); }}>Back</Txt>
              </View>
            ) : null}

            {err ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle" size={18} color={c.bad} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt v="small" style={{ color: c.bad, fontWeight: '500' }}>{err}</Txt>
                  {/could not find an account/i.test(err) && mode === 'signin' ? <Txt v="small" style={s.link} onPress={() => switchMode('signup')}>Sign up instead</Txt> : null}
                  {/already has an account/i.test(err) && signup ? <Txt v="small" style={s.link} onPress={() => switchMode('signin')}>Sign in instead</Txt> : null}
                </View>
              </View>
            ) : null}

            {step !== 'password' ? (
              <View style={s.footer}>
                <Txt v="small">
                  {signup ? 'Already have an account? ' : 'New here? '}
                  <Txt v="small" style={s.link} onPress={() => switchMode(signup ? 'signin' : 'signup')}>{signup ? 'Sign in' : 'Sign up'}</Txt>
                </Txt>
                {!INNER_CIRCLE_ONLY ? (
                  <View style={s.row}>
                    <Txt v="small" style={s.link} onPress={() => { setStep('password'); setErr(''); }}>Business sign in</Txt>
                    <Txt v="small" style={s.link} onPress={() => router.push('/company-register')}>Register a company</Txt>
                  </View>
                ) : !signup ? (
                  // Hidden behind INNER_CIRCLE_ONLY before, which left email code as the only way
                  // into this build: when the code email failed, nobody could sign in at all.
                  <Txt v="small" style={s.link} onPress={() => { setStep('password'); setErr(''); }}>Sign in with password</Txt>
                ) : null}
                {DEMO_ENABLED ? (
                  <Txt v="small" style={{ textDecorationLine: 'underline' }} onPress={() => startDemo('TECH')}>
                    Just looking? Open the demo with sample data
                  </Txt>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.page },
  top: { paddingHorizontal: 22, paddingBottom: 56, overflow: 'hidden' },
  orbA: { position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -80, top: -70, backgroundColor: 'rgba(255,255,255,0.07)' },
  orbB: { position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -50, bottom: -60, backgroundColor: 'rgba(255,165,30,0.14)' },
  back: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  sheet: { flex: 1, marginTop: -30, backgroundColor: c.page, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, gap: 18 },
  tabs: { flexDirection: 'row', backgroundColor: c.violetSoft, borderRadius: 14, padding: 4 },
  tab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: c.violet },
  input: { backgroundColor: c.raised, borderColor: c.line, borderWidth: 1.5, color: c.ink, borderRadius: r.md, paddingHorizontal: 14, minHeight: 52, fontSize: 16, fontFamily: font.regular },
  inputFocus: { borderColor: c.violet },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, height: 58, borderRadius: r.md, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: c.violet, backgroundColor: c.violetSoft },
  boxActive: { borderColor: c.orange, ...lift },
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: c.violet, fontWeight: '700' },
  errBox: { flexDirection: 'row', gap: 10, backgroundColor: c.badSoft, borderRadius: r.md, padding: 12 },
  footer: { alignItems: 'center', gap: 14, marginTop: 4 },
});

void ActivityIndicator;
