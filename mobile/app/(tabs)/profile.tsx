import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Button, Card, Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { humanize } from '../../lib/format';
import { useSession } from '../../lib/session';
import { c } from '../../lib/theme';

const SITE = 'https://www.doitforme.in';

export default function Profile() {
  const { profile, session, signOut } = useSession();
  const [del, setDel] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Irreversible, so it needs the typed word the API also demands (App Store 5.1.1(v)).
  async function deleteAccount() {
    setBusy(true);
    setErr('');
    const res = await api('/api/account/delete', { body: { confirm: word } });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? 'Could not delete the account.');
    setDel(false);
    Alert.alert('Account deleted', 'Your account has been removed.');
    await signOut();
  }

  const kyc = profile?.kyc_verified ? 'approved' : (profile?.kyc_status ?? 'none');
  const initial = (profile?.name ?? session?.user.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <Text style={s.name}>{profile?.name ?? 'Your profile'}</Text>
        <Text style={s.muted}>{session?.user.email}</Text>
        <Text style={s.muted}>{profile?.college}</Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <Row k="Rating" v={profile?.rating ? `${Number(profile.rating).toFixed(1)} (${profile.rating_count ?? 0})` : 'No ratings yet'} />
        <Row k="Jobs completed" v={String(profile?.jobs_completed ?? 0)} />
        <View style={s.row}>
          <Text style={s.k}>Student ID</Text>
          <Pill label={humanize(kyc)} tone={kyc === 'approved' ? 'ok' : 'neutral'} />
        </View>
      </Card>

      {kyc !== 'approved' ? <Button label="Verify student ID" variant="ghost" onPress={() => router.push('/verify-id')} /> : null}
      <Button label="Delete account" variant="ghost" onPress={() => setDel(true)} />
      <Button label="Sign out" onPress={signOut} />
      <Text style={s.legal} onPress={() => Linking.openURL(`${SITE}/privacy-policy`)}>
        Privacy policy
      </Text>
      <Sheet visible={del} title="Delete your account" onClose={() => setDel(false)}>
        <Text style={s.v}>This cannot be undone. Accounts with money in escrow or tasks in progress cannot be deleted until those finish.</Text>
        <Field label="Type DELETE to confirm" value={word} onChangeText={setWord} autoCapitalize="characters" />
        <ErrorText>{err}</ErrorText>
        <Button label="Delete my account" loading={busy} onPress={deleteAccount} />
      </Sheet>
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.violet, fontSize: 28, fontWeight: '700' },
  name: { color: c.inkStrong, fontSize: 20, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { color: c.muted, fontSize: 14 },
  v: { color: c.ink, fontSize: 14, fontWeight: '600' },
  legal: { color: c.muted, textAlign: 'center', paddingVertical: 12, textDecorationLine: 'underline' },
});
