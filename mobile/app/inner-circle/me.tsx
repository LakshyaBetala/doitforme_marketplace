import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Reveal, ScreenHeader, Stat } from '../../components/ic/kit';
import { Txt } from '../../components/ic/Txt';
import { Button, Card, Pill } from '../../components/ui';
import { api, SITE } from '../../lib/api';
import { humanize, rupees } from '../../lib/format';
import { useSession } from '../../lib/session';
import { c, lift } from '../../lib/theme';

type Icon = keyof typeof Ionicons.glyphMap;

// The only account screen in the Inner Circle app: profile, payout details, help and legal
// (which open the website), sign out, and in-app account deletion (store policy requires it).
export default function Account() {
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
  const member = Boolean(profile?.is_elite);
  const role = profile?.inner_circle_role;
  const open = (path: string) => Linking.openURL(`${SITE}${path}`);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.page }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <ScreenHeader eyebrow="The Inner Circle" title="Account" />
      <View style={{ padding: 20, gap: 22 }}>
        <Reveal i={0}>
          <Card style={s.id}>
            <View style={s.avatar}>
              <Txt v="title" style={{ color: '#fff', fontSize: 28 }}>{initial}</Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="heading" numberOfLines={1} style={{ fontSize: 19 }}>{profile?.name ?? 'Your profile'}</Txt>
              {profile?.username ? <Txt v="small">@{profile.username}</Txt> : null}
              <Txt v="small" numberOfLines={1}>{profile?.college ?? session?.user.email}</Txt>
              <View style={{ marginTop: 8 }}>
                <Pill label={member ? `${role === 'OUTREACH' ? 'Outreach' : 'Builder'} member` : 'Applicant'} tone={member ? 'ok' : 'neutral'} />
              </View>
            </View>
          </Card>
        </Reveal>

        <Reveal i={1} style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Rating" value={profile?.rating ? Number(profile.rating).toFixed(1) : '–'} />
          <Stat label="Jobs done" value={profile?.jobs_completed ?? 0} />
          <Stat label="Earned" value={rupees(profile?.total_earned)} tone="ok" />
        </Reveal>

        <Reveal i={2} style={{ gap: 10 }}>
          <Txt v="eyebrow">Your account</Txt>
          <Card style={s.list}>
            <Item icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
            <Item icon="wallet-outline" label="Earnings and payout details" onPress={() => router.push('/payouts')} />
            <Item
              icon="shield-checkmark-outline"
              label="Student ID"
              right={<Pill label={humanize(kyc)} tone={kyc === 'approved' ? 'ok' : 'warn'} />}
              onPress={() => (kyc === 'approved' ? undefined : router.push('/verify-id'))}
            />
            <Item icon="notifications-outline" label="Notification settings" onPress={() => router.push('/notification-settings')} last />
          </Card>
        </Reveal>

        <Reveal i={3} style={{ gap: 10 }}>
          <Txt v="eyebrow">Help and legal</Txt>
          <Card style={s.list}>
            <Item icon="help-buoy-outline" label="Help and support" external onPress={() => open('/contact')} />
            <Item icon="document-text-outline" label="Terms" external onPress={() => open('/terms')} />
            <Item icon="lock-closed-outline" label="Privacy policy" external onPress={() => open('/privacy-policy')} />
            <Item icon="receipt-outline" label="Refund policy" external onPress={() => open('/refund-policy')} />
            <Item icon="cube-outline" label="Shipping policy" external onPress={() => open('/shipping-policy')} last />
          </Card>
        </Reveal>

        <Reveal i={4} style={{ gap: 12 }}>
          <Button label="Sign out" variant="dark" icon="log-out-outline" onPress={signOut} />
          <Pressable onPress={() => setDel(true)} style={s.delete} accessibilityRole="button">
            <Txt v="small" style={{ color: c.bad, fontWeight: '700' }}>Delete my account</Txt>
          </Pressable>
        </Reveal>
      </View>

      <Sheet visible={del} title="Delete your account" onClose={() => setDel(false)}>
        <Txt v="small">This cannot be undone. Accounts with money in escrow or tasks in progress cannot be deleted until those finish.</Txt>
        <Field label="Type DELETE to confirm" value={word} onChangeText={setWord} autoCapitalize="characters" />
        <ErrorText>{err}</ErrorText>
        <Button label="Delete my account" loading={busy} onPress={deleteAccount} />
      </Sheet>
    </ScrollView>
  );
}

function Item({ icon, label, onPress, last, right, external }: { icon: Icon; label: string; onPress: () => void; last?: boolean; right?: React.ReactNode; external?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.item, !last && s.line, pressed && { backgroundColor: c.violetSoft }]} accessibilityRole="button">
      <View style={s.itemIcon}>
        <Ionicons name={icon} size={18} color={c.violet} />
      </View>
      <Txt v="body" style={{ flex: 1, color: c.inkStrong, fontWeight: '600' }}>{label}</Txt>
      {right ? <View>{right}</View> : null}
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={16} color={c.faint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  id: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 68, height: 68, borderRadius: 22, backgroundColor: c.violet, alignItems: 'center', justifyContent: 'center', ...lift },
  list: { padding: 0, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56 },
  line: { borderBottomWidth: 1, borderBottomColor: c.line },
  itemIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center' },
  delete: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
