import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Button, Card, Pill } from '../../components/ui';
import { api, SITE } from '../../lib/api';
import { humanize, rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

export default function Profile() {
  const { profile, session, signOut } = useSession();
  const [del, setDel] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [refCount, setRefCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    supabase.from('referrals').select('id').eq('referrer_id', session.user.id).then(({ data }) => setRefCount(data?.length ?? 0));
  }, [session]);

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
  const isCompany = profile?.role === 'COMPANY';
  const code = profile?.referral_code;

  const open = (path: string) => Linking.openURL(`${SITE}${path}`);

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <Text style={s.name}>{profile?.name ?? 'Your profile'}</Text>
        {profile?.username ? <Text style={s.muted}>@{profile.username}</Text> : null}
        <Text style={s.muted}>{session?.user.email}</Text>
        <Text style={s.muted}>{profile?.college}</Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <Row k="Rating" v={profile?.rating ? `${Number(profile.rating).toFixed(1)} (${profile.rating_count ?? 0})` : 'No ratings yet'} />
        <Row k="Jobs completed" v={String(profile?.jobs_completed ?? 0)} />
        <Row k="Total earned" v={rupees(profile?.total_earned)} />
        <View style={s.row}>
          <Text style={s.k}>Student ID</Text>
          <Pill label={humanize(kyc)} tone={kyc === 'approved' ? 'ok' : 'neutral'} />
        </View>
      </Card>

      {code ? (
        <Card style={{ gap: 6 }}>
          <Text style={s.h}>Refer & earn</Text>
          <Text style={s.code}>{code}</Text>
          <Text style={s.muted}>
            {refCount} {refCount === 1 ? 'friend' : 'friends'} joined · {profile?.points_balance ?? 0} points
          </Text>
          <Button
            label="Share my code"
            variant="ghost"
            onPress={() => Share.share({ message: `Join me on DoItForMe! Use my referral code ${code} when you sign up.` })}
          />
        </Card>
      ) : null}

      <Card style={{ padding: 0 }}>
        <Item label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Item label="Worker profile (skills, resume)" onPress={() => router.push('/worker-setup')} />
        {profile?.username ? <Item label="View my public profile" onPress={() => router.push(`/u/${profile.username}`)} /> : null}
        <Item label="Earnings" onPress={() => router.push('/payouts')} />
        <Item label="Notifications" onPress={() => router.push('/notification-settings')} />
        {kyc !== 'approved' ? <Item label="Verify student ID" onPress={() => router.push('/verify-id')} /> : null}
        {isCompany ? <Item label="Company dashboard" onPress={() => router.push('/company')} /> : null}
        {profile?.inner_circle_role ? <Item label="Inner Circle" onPress={() => router.push('/inner-circle')} /> : null}
        <Item label="Talent: browse services" onPress={() => router.push('/talent')} last />
      </Card>

      <Card style={{ padding: 0 }}>
        <Item label="Pricing" onPress={() => open('/pricing')} />
        <Item label="Terms" onPress={() => open('/terms')} />
        <Item label="Privacy policy" onPress={() => open('/privacy-policy')} />
        <Item label="Refund policy" onPress={() => open('/refund-policy')} />
        <Item label="Shipping policy" onPress={() => open('/shipping-policy')} />
        <Item label="Contact us" onPress={() => open('/contact')} />
        <Item label="About" onPress={() => open('/about')} last />
      </Card>

      <Button label="Delete account" variant="ghost" onPress={() => setDel(true)} />
      <Button label="Sign out" onPress={signOut} />

      <Sheet visible={del} title="Delete your account" onClose={() => setDel(false)}>
        <Text style={s.v}>This cannot be undone. Accounts with money in escrow or tasks in progress cannot be deleted until those finish.</Text>
        <Field label="Type DELETE to confirm" value={word} onChangeText={setWord} autoCapitalize="characters" />
        <ErrorText>{err}</ErrorText>
        <Button label="Delete my account" loading={busy} onPress={deleteAccount} />
      </Sheet>
    </ScrollView>
  );
}

function Item({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.item, !last && s.itemLine]}>
      <Text style={s.itemText}>{label}</Text>
      <Text style={s.chev}>›</Text>
    </Pressable>
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
  h: { color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  code: { color: c.violet, fontSize: 24, fontWeight: '800', letterSpacing: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { color: c.muted, fontSize: 14 },
  v: { color: c.ink, fontSize: 14, fontWeight: '600' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, minHeight: 50 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: c.line },
  itemText: { color: c.ink, fontSize: 15 },
  chev: { color: c.faint, fontSize: 22 },
});
