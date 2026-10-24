import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Checkout, CheckoutResult, RazorpayOrder } from '../../components/Checkout';
import { Button, Card, Empty, Loading, Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { humanize, rupees, timeAgo, toneFor } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

// Ported from app/company/dashboard/page.tsx: the company's tasks plus Pro (₹299 a month).
// The paid add-on settles through /api/company/pro/verify, not the escrow verify route.
export default function CompanyDashboard() {
  const { session, profile } = useSession();
  const [gigs, setGigs] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const paid = useRef(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const [g, co, u] = await Promise.all([
      supabase.from('gigs').select('*').eq('poster_id', uid).order('created_at', { ascending: false }),
      supabase.from('companies').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('users').select('is_verified_company').eq('id', uid).maybeSingle(),
    ]);
    setGigs(g.data ?? []);
    setCompany(co.data ?? null);
    setVerified(Boolean(u.data?.is_verified_company));
  }, [session?.user.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const isPro = !!(company?.pro_until && new Date(company.pro_until) > new Date());

  async function getPro() {
    setBusy(true);
    const res = await api<RazorpayOrder & { provider?: string }>('/api/company/pro/create-order', { body: {} });
    setBusy(false);
    if (!res.ok || res.data?.provider !== 'RAZORPAY') return Alert.alert('Could not start payment', res.error ?? 'Payments are unavailable right now.');
    paid.current = false;
    setOrder({ ...res.data, gig_title: 'Company Pro, 1 month' });
  }

  async function onCheckout(r: CheckoutResult) {
    if (r.type === 'dismiss') {
      if (!paid.current) {
        setOrder(null);
        Alert.alert('Payment cancelled', 'Nothing was charged.');
      }
      return;
    }
    if (r.type === 'failed') {
      setOrder(null);
      return Alert.alert('Payment failed', `${r.message} Nothing was charged.`);
    }
    paid.current = true;
    setOrder(null);
    const v = await api('/api/company/pro/verify', {
      body: { razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature },
    });
    if (!v.ok) Alert.alert('Payment received', `${v.error ?? 'We could not confirm it yet.'} Do not pay again; if Pro does not show shortly, contact support.`);
    else Alert.alert('Pro is active', 'Your tasks are now featured.');
    await load();
  }

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <FlatList
        data={gigs}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Text style={s.hi}>{company?.name ?? profile?.name ?? 'Your company'}</Text>
            {verified === false ? (
              <Card style={{ backgroundColor: c.orangeSoft, gap: 4 }}>
                <Text style={s.warnH}>Awaiting verification</Text>
                <Text style={s.warn}>Our team checks every new company before it can post tasks. You will get an email once it is cleared.</Text>
              </Card>
            ) : null}
            <Card style={{ gap: 6 }}>
              <View style={s.row}>
                <Text style={s.h}>Company Pro</Text>
                {isPro ? <Pill label="Active" tone="ok" /> : <Pill label="Free plan" />}
              </View>
              <Text style={s.muted}>
                {isPro
                  ? `Unlimited tasks, featured on the feed. Valid until ${new Date(company.pro_until).toLocaleDateString('en-IN')}.`
                  : 'Free plan includes 1 task. Pro is ₹299 a month: unlimited tasks, featured on the feed.'}
              </Text>
              {!isPro ? <Button label="Get Pro" onPress={getPro} loading={busy} /> : null}
            </Card>
            <Button label="Post a task" onPress={() => router.push('/company/post')} />
            <Text style={s.h}>Your tasks</Text>
          </View>
        }
        ListEmptyComponent={<Empty title="No tasks yet" hint="Post your first task to start receiving applications." />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/gig/${item.id}`)} style={{ gap: 6 }}>
            <View style={s.row}>
              <Text style={s.title} numberOfLines={2}>{item.title}</Text>
              <Text style={s.price}>{rupees(item.price)}</Text>
            </View>
            <View style={s.pills}>
              <Pill label={humanize(item.status)} tone={toneFor(item.status)} />
              {item.max_workers > 1 ? <Pill label={`${item.max_workers} workers`} /> : null}
              {item.is_managed ? <Pill label="Managed" /> : null}
            </View>
            <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
          </Card>
        )}
      />
      <Checkout order={order} onResult={onCheckout} />
    </View>
  );
}

const s = StyleSheet.create({
  hi: { color: c.inkStrong, fontSize: 22, fontWeight: '700' },
  h: { color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontSize: 16, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  muted: { color: c.muted, fontSize: 13 },
  warnH: { color: c.orangeInk, fontWeight: '700' },
  warn: { color: c.orangeInk, fontSize: 14, lineHeight: 20 },
});
