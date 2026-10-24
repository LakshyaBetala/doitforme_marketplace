import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText, Field } from '../../components/form';
import { Button, Card, Loading, Pill } from '../../components/ui';
import { humanize, toneFor } from '../../lib/format';
import { useSession } from '../../lib/session';
import { isDemo, supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

type Role = 'TECH' | 'OUTREACH';

// Ported from app/inner-circle/page.tsx. Membership is is_elite plus inner_circle_role;
// both are set only by an admin approving an application, never from here.
export default function InnerCircle() {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [elite, setElite] = useState(false);
  const [memberRole, setMemberRole] = useState<Role | null>(null);
  const [kyc, setKyc] = useState<string | null>(null);
  const [application, setApplication] = useState<any>(null);
  const [role, setRole] = useState<Role>('TECH');
  const [pitch, setPitch] = useState('');
  const [links, setLinks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const [p, a] = await Promise.all([
      supabase.from('users').select('is_elite, inner_circle_role, kyc_status').eq('id', session.user.id).maybeSingle(),
      supabase.from('inner_circle_applications').select('id, status, decision_note, created_at, role').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1),
    ]);
    setElite(Boolean(p.data?.is_elite));
    setMemberRole((p.data?.inner_circle_role as Role) ?? null);
    setKyc(p.data?.kyc_status ?? null);
    const latest = a.data?.[0] ?? null;
    setApplication(latest);
    if (latest?.role) setRole(latest.role);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply() {
    setErr('');
    if (pitch.trim().length < 40) return setErr('Tell us a bit more. A couple of sentences about what you do best.');
    if (isDemo()) return setErr('Demo mode: applying is switched off.');
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from('inner_circle_applications').insert({
      user_id: session.user.id,
      role,
      pitch: pitch.trim(),
      links: links.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean).slice(0, 5),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    await load();
  }

  if (loading) return <Loading />;
  const pending = application?.status === 'pending';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: 'Inner Circle', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Text style={s.eyebrow}>Invite only</Text>
          <Text style={s.heroTitle}>The Inner Circle</Text>
          <Text style={s.heroBody}>A small group of students we put in front of real companies first. Paid briefs, proper budgets, and work worth putting your name on.</Text>
        </View>

        {elite ? (
          <Card style={{ gap: 10 }}>
            <Pill label={`Member · ${memberRole === 'OUTREACH' ? 'Outreach' : 'Tech'}`} tone="ok" />
            <Text style={s.body}>You are in. {memberRole === 'OUTREACH' ? 'Track the companies you are reaching out to.' : 'Your assigned briefs and where each one stands.'}</Text>
            {memberRole === 'OUTREACH' ? (
              <Button label="Open outreach tracker" onPress={() => router.push('/inner-circle/outreach')} />
            ) : (
              <Button label="Open my briefs" onPress={() => router.push('/inner-circle/work')} />
            )}
          </Card>
        ) : pending ? (
          <Card style={{ gap: 6 }}>
            <Pill label="Application under review" tone="warn" />
            <Text style={s.body}>A person reads every application. You will hear back by email.</Text>
          </Card>
        ) : (
          <>
            {application?.status === 'rejected' ? (
              <Card style={{ gap: 6 }}>
                <Pill label={humanize(application.status)} tone={toneFor(application.status)} />
                {application.decision_note ? <Text style={s.body}>{application.decision_note}</Text> : null}
                <Text style={s.muted}>You can apply again below.</Text>
              </Card>
            ) : null}
            {kyc !== 'approved' ? (
              <Card style={{ gap: 6 }}>
                <Text style={s.body}>Verified students are looked at first. Verify your student ID to improve your chances.</Text>
                <Button label="Verify student ID" variant="ghost" onPress={() => router.push('/verify-id')} />
              </Card>
            ) : null}
            <Text style={s.label}>Which role?</Text>
            <View style={s.chips}>
              {(['TECH', 'OUTREACH'] as Role[]).map((k) => (
                <Pressable key={k} onPress={() => setRole(k)} style={[s.chip, role === k && s.chipOn]}>
                  <Text style={[s.chipText, role === k && { color: '#fff' }]}>{k === 'TECH' ? 'Tech: build briefs' : 'Outreach: find companies'}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="What do you do best?" value={pitch} onChangeText={setPitch} multiline placeholder="At least a couple of sentences" />
            <Field label="Links (optional, up to 5)" value={links} onChangeText={setLinks} autoCapitalize="none" placeholder="GitHub, portfolio, LinkedIn" />
            <ErrorText>{err}</ErrorText>
            <Button label="Apply to join" onPress={apply} loading={busy} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: c.rail, borderRadius: 16, padding: 20, gap: 6 },
  eyebrow: { color: '#ffd28c', fontWeight: '700', fontSize: 13 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroBody: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22 },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: c.muted, fontSize: 13 },
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.violetSoft },
  chipOn: { backgroundColor: c.violet },
  chipText: { color: c.violet, fontWeight: '600', fontSize: 13 },
});
