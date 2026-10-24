import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Attachments } from '../../components/Attachments';
import { Checkout, CheckoutResult, RazorpayOrder } from '../../components/Checkout';
import { ErrorText, Field, Sheet } from '../../components/form';
import { Button, Card, Empty, Loading, Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { humanize, rupees, timeAgo, toneFor } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';
import { canFundEscrow, isServiceAdvert } from '../../shared/gigRoles';

type Form = null | 'apply' | 'deliver' | 'changes' | 'dispute' | 'upi' | 'approve' | 'rate' | 'request';

// Queries ported from app/gig/[id]/page.tsx and app/activity/page.tsx. Every write goes
// through the same API route the website uses, so server-side rules (moderation, caps,
// KYC gate, escrow RPCs) apply unchanged. Nothing here updates `gigs` directly.
export default function GigDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const [gig, setGig] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [myApp, setMyApp] = useState<any>(null);
  const [rated, setRated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState<Form>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [pitch, setPitch] = useState('');
  const [offer, setOffer] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [upi, setUpi] = useState('');
  const [text, setText] = useState('');
  const [stars, setStars] = useState(5);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const paid = useRef(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('gigs').select('*').eq('id', id).single();
    if (e || !data) {
      setError(e?.message ?? 'Task not found');
      setLoading(false);
      return;
    }
    setGig(data);
    const isPoster = data.poster_id === me;
    const [p, a, mine, rt] = await Promise.all([
      supabase.from('users').select('name, avatar_url, rating, college, username').eq('id', data.poster_id).single(),
      isPoster
        ? supabase.from('applications').select('*, worker:users!worker_id(id, name, rating, college, username)').eq('gig_id', id)
        : Promise.resolve({ data: [] as any[] }),
      !isPoster && me
        ? supabase.from('applications').select('*').eq('gig_id', id).eq('worker_id', me).maybeSingle()
        : Promise.resolve({ data: null }),
      // Has this worker already rated the poster? (one rating per gig)
      !isPoster && me
        ? supabase.from('ratings').select('id').eq('gig_id', id).eq('rater_id', me).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setPoster(p.data);
    setApplicants((a as any).data ?? []);
    setMyApp((mine as any).data ?? null);
    setRated(Boolean((rt as any).data));
    setLoading(false);
  }, [id, me]);

  useEffect(() => {
    void load();
  }, [load]);

  function close() {
    setForm(null);
    setFormErr('');
  }

  // Runs one action against the website API, then refreshes. `ok` is shown to the user.
  async function act(path: string, body: unknown, ok: string, after?: (data: any) => void) {
    setBusy(true);
    setFormErr('');
    const res = await api(path, { body });
    setBusy(false);
    if (!res.ok) {
      // Deliver asks for a payout UPI at the last useful moment (see /api/gig/deliver).
      if (res.status === 409 && res.data?.code === 'UPI_REQUIRED') return setForm('upi');
      setFormErr(res.error ?? 'Something went wrong.');
      if (!form) Alert.alert('Could not complete', res.error ?? 'Something went wrong.');
      return;
    }
    close();
    after?.(res.data);
    Alert.alert('Done', ok);
    await load();
  }

  // Both money entry points (hire an applicant, fund an assigned gig) return a Razorpay
  // order. The server fixes the amount; we only open checkout and forward the signature.
  async function startPayment(path: string, body: unknown) {
    setBusy(true);
    const res = await api<RazorpayOrder & { provider?: string }>(path, { body });
    setBusy(false);
    if (!res.ok || res.data?.provider !== 'RAZORPAY') return Alert.alert('Could not start payment', res.error ?? 'Payments are unavailable right now.');
    paid.current = false;
    setOrder(res.data);
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
    const v = await api('/api/payments/verify-payment', {
      body: { razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature },
    });
    // The money may well have been taken. Never say "failed" flatly: a poster who thinks it
    // failed will pay twice.
    if (!v.ok) Alert.alert('Payment received', `${v.error ?? 'We could not confirm it yet.'} Do not pay again; if the status does not update shortly, contact support.`);
    else Alert.alert('Payment confirmed', 'Escrow is funded and the student can start.');
    await load();
  }

  const confirm = (title: string, msg: string, go: () => void) =>
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: go }]);

  if (loading) return <Loading />;
  if (!gig) return <Empty title="Could not open this task" hint={error} />;

  const status = String(gig.status ?? '').toLowerCase();
  const isPoster = gig.poster_id === me;
  const isWorker = gig.assigned_worker_id === me;
  const advert = isServiceAdvert(gig);
  const attachments: string[] = Array.isArray(gig.images) ? gig.images : [];
  const canApply = !isPoster && status === 'open' && !myApp && !advert;
  const delivered = status === 'delivered';
  const awaitingFunds = status === 'awaiting_funds' && gig.payment_gateway !== 'DIRECT' && canFundEscrow(gig);
  const chatWith = (other: string, name: string) =>
    router.push({ pathname: '/chat/[gigId]', params: { gigId: id, other, name } });

  return (
    <>
      <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card style={{ gap: 10 }}>
          <Text style={s.title}>{gig.title}</Text>
          <Text style={s.price}>{advert ? `From ${rupees(gig.price)}` : rupees(gig.price)}</Text>
          <View style={s.pills}>
            <Pill label={advert ? 'Service' : humanize(gig.status)} tone={status === 'open' ? 'ok' : toneFor(gig.status)} />
            {gig.category ? <Pill label={humanize(gig.category)} /> : null}
            {gig.location ? <Pill label={gig.location} /> : null}
            {myApp ? <Pill label={`You: ${humanize(myApp.status)}`} tone={toneFor(myApp.status)} /> : null}
          </View>
          <Text style={s.meta}>
            Posted {timeAgo(gig.created_at)}
            {gig.deadline ? ` · due ${new Date(gig.deadline).toLocaleDateString('en-IN')}` : ''}
          </Text>
        </Card>

        {gig.description ? (
          <Card>
            <Text style={s.h}>{advert ? 'About this service' : 'About this task'}</Text>
            <Text style={s.body}>{gig.description}</Text>
            {gig.github_link ? (
              <Text style={s.link} onPress={() => Linking.openURL(gig.github_link)}>
                {gig.github_link}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Attachments paths={attachments} />

        <Card style={{ gap: 4 }}>
          <Text style={s.h}>{advert ? 'Offered by' : 'Posted by'}</Text>
          <Pressable disabled={!poster?.username} onPress={() => router.push(`/u/${poster.username}`)}>
            <Text style={[s.body, poster?.username && { color: c.violet }]}>{poster?.name ?? 'Unknown'}</Text>
          </Pressable>
          {poster?.college ? <Text style={s.meta}>{poster.college}</Text> : null}
          {poster?.rating ? <Text style={s.meta}>Rating {Number(poster.rating).toFixed(1)}</Text> : null}
        </Card>

        {isPoster && applicants.length > 0 ? (
          <Card style={{ gap: 10 }}>
            <Text style={s.h}>Applicants ({applicants.length})</Text>
            {applicants.map((a) => (
              <View key={a.id} style={s.applicant}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={s.body}>{a.worker?.name ?? 'Student'}</Text>
                  <Text style={s.meta}>
                    {[a.worker?.college, a.worker?.rating ? `★ ${Number(a.worker.rating).toFixed(1)}` : null].filter(Boolean).join(' · ')}
                  </Text>
                  {a.pitch ? <Text style={s.meta} numberOfLines={3}>{a.pitch}</Text> : null}
                  {a.negotiated_price ? <Text style={s.meta}>Offers {rupees(a.negotiated_price)}</Text> : null}
                </View>
                {status === 'open' && !gig.assigned_worker_id && a.status === 'pending' ? (
                  <Button
                    label="Hire & pay"
                    loading={busy}
                    onPress={() =>
                      confirm(`Hire ${a.worker?.name ?? 'this student'}?`, 'You pay the task price plus a small payment-gateway fee into escrow. It is released only when you approve their work.', () =>
                        startPayment('/api/gig/hire', { gigId: id, workerId: a.worker_id }),
                      )
                    }
                  />
                ) : null}
                <Button label="Message" variant="ghost" onPress={() => chatWith(a.worker_id, a.worker?.name ?? 'Student')} />
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ gap: 10 }}>
          {canApply ? <Button label="Apply for this task" onPress={() => setForm('apply')} /> : null}
          {advert && !isPoster && status === 'open' ? <Button label="Request this service" onPress={() => setForm('request')} /> : null}
          {!isPoster && gig.poster_id ? <Button label={advert ? 'Message provider' : 'Message poster'} variant="ghost" onPress={() => chatWith(gig.poster_id, poster?.name ?? 'Poster')} /> : null}
          {isWorker && (status === 'assigned' || delivered) ? (
            <Button label={delivered ? 'Resubmit work' : 'Submit work'} onPress={() => setForm('deliver')} />
          ) : null}
          {isWorker && status === 'completed' && !rated ? <Button label="Rate the poster" variant="ghost" onPress={() => setForm('rate')} /> : null}
          {isPoster && gig.assigned_worker_id ? <Button label="Chat with worker" variant="ghost" onPress={() => chatWith(gig.assigned_worker_id, 'Worker')} /> : null}
          {isPoster && awaitingFunds ? <Button label="Pay & start work" loading={busy} onPress={() => startPayment('/api/payments/create-order', { gigId: id })} /> : null}
          {isPoster && delivered ? (
            <>
              <Button label="Approve & release payment" onPress={() => setForm('approve')} />
              <Button label="Request changes" variant="ghost" onPress={() => setForm('changes')} />
              <Button label="Raise a dispute" variant="ghost" onPress={() => setForm('dispute')} />
            </>
          ) : null}
          {isPoster && status === 'open' && !gig.assigned_worker_id ? (
            <Button
              label="Take down this listing"
              variant="ghost"
              onPress={() => confirm('Take it down?', 'Anyone who applied will be told it closed.', () => act('/api/gig/delete', { gigId: id }, 'Listing removed.', () => router.back()))}
            />
          ) : null}
        </View>
      </ScrollView>

      <Checkout order={order} onResult={onCheckout} />

      <Sheet visible={form === 'apply'} title="Apply for this task" onClose={close}>
        <Field label="Why you? (optional)" value={pitch} onChangeText={setPitch} multiline placeholder="A line or two about your experience" />
        <Field label="Your price (optional)" value={offer} onChangeText={setOffer} keyboardType="number-pad" placeholder={`Task pays ${rupees(gig.price)}`} hint="Only fill this to counter-offer." />
        <ErrorText>{formErr}</ErrorText>
        <Button
          label="Send application"
          loading={busy}
          onPress={() => act('/api/gig/apply', { gigId: id, offerPitch: pitch.trim() || undefined, offerPrice: Number(offer) > 0 ? Number(offer) : undefined }, 'Application sent.', () => { setPitch(''); setOffer(''); })}
        />
      </Sheet>

      <Sheet visible={form === 'request'} title="Request this service" onClose={close}>
        <Text style={s.body}>Tell them what you need. They can accept, and then you pay into escrow like any task.</Text>
        <Field label="Your brief" value={text} onChangeText={setText} multiline placeholder="What exactly do you need?" />
        <Field label="Your price (optional)" value={offer} onChangeText={setOffer} keyboardType="number-pad" placeholder={`Listed from ${rupees(gig.price)}`} />
        <ErrorText>{formErr}</ErrorText>
        <Button
          label="Send request"
          loading={busy}
          onPress={() =>
            act('/api/gig/request-service', { serviceId: id, brief: text.trim(), offerPrice: Number(offer) > 0 ? Number(offer) : undefined }, 'Request sent.', (d) => {
              setText('');
              setOffer('');
              if (d?.gigId) router.replace(`/gig/${d.gigId}`);
            })
          }
        />
      </Sheet>

      <Sheet visible={form === 'deliver'} title="Submit your work" onClose={close}>
        <Field label="What did you deliver? (required)" value={note} onChangeText={setNote} multiline placeholder="Describe what was done and how to use it" />
        <Field label="Link to the files (optional)" value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="Drive, Figma, GitHub..." />
        <ErrorText>{formErr}</ErrorText>
        <Button label="Submit" loading={busy} onPress={() => act('/api/gig/deliver', { gigId: id, note: note.trim(), deliveryLink: link.trim() || undefined }, 'Submitted. The poster has 24 hours to review.')} />
      </Sheet>

      <Sheet visible={form === 'upi'} title="Where should we pay you?" onClose={close}>
        <Text style={s.body}>Add the UPI ID you want to be paid on. You only need to do this once.</Text>
        <Field label="UPI ID" value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="name@bank" />
        <ErrorText>{formErr}</ErrorText>
        <Button
          label="Save and submit"
          loading={busy}
          onPress={() => act('/api/gig/deliver', { gigId: id, note: note.trim(), deliveryLink: link.trim() || undefined, upiId: upi.trim() }, 'Submitted. The poster has 24 hours to review.')}
        />
      </Sheet>

      <Sheet visible={form === 'approve'} title="Approve the work" onClose={close}>
        <Text style={s.body}>The money leaves escrow and cannot be pulled back. If something is wrong, request changes or raise a dispute instead.</Text>
        <Text style={s.h}>How was the work?</Text>
        <Stars value={stars} onChange={setStars} />
        <Field label="Short review (optional, public on their profile)" value={text} onChangeText={setText} multiline />
        <ErrorText>{formErr}</ErrorText>
        {/* /api/gig/complete releases through manual_release_escrow AND records the rating.
            Never also call /api/escrow/release for the same gig: the second call fails after
            the money has already moved. */}
        <Button
          label="Approve & release payment"
          loading={busy}
          onPress={() => act('/api/gig/complete', { gigId: id, rating: stars, review: text.trim() }, 'Approved. The payment reaches the student within 24–48 hours.', () => setText(''))}
        />
      </Sheet>

      <Sheet visible={form === 'rate'} title="Rate the poster" onClose={close}>
        <Stars value={stars} onChange={setStars} />
        <Field label="Short review (optional)" value={text} onChangeText={setText} multiline />
        <ErrorText>{formErr}</ErrorText>
        <Button label="Save rating" loading={busy} onPress={() => act('/api/gig/rate-poster', { gigId: id, rating: stars, review: text.trim() }, 'Thanks, that helps the next student.', () => { setText(''); setRated(true); })} />
      </Sheet>

      <Sheet visible={form === 'changes'} title="Request changes" onClose={close}>
        <Field label="What should be fixed?" value={text} onChangeText={setText} multiline placeholder="Be specific so the student can fix it quickly" />
        <ErrorText>{formErr}</ErrorText>
        <Button label="Send feedback" loading={busy} onPress={() => act('/api/gig/request-changes', { gigId: id, feedback: text.trim() }, 'Sent. The student can resubmit.', () => setText(''))} />
      </Sheet>

      <Sheet visible={form === 'dispute'} title="Raise a dispute" onClose={close}>
        <Text style={s.body}>The payment stays held while we review. We reply within 48 hours.</Text>
        <Field label="What went wrong?" value={text} onChangeText={setText} multiline placeholder="A sentence or two at least" />
        <ErrorText>{formErr}</ErrorText>
        <Button
          label="Open dispute"
          loading={busy}
          onPress={() => (text.trim().length < 10 ? setFormErr('Please describe the problem in a sentence or two.') : act('/api/gig/dispute', { gigId: id, reason: text.trim() }, 'Dispute opened. We reply within 48 hours.', () => setText('')))}
        />
      </Sheet>
    </>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} onPress={() => onChange(n)} style={{ fontSize: 34, color: n <= value ? c.orange : c.line }}>
          ★
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: c.inkStrong, fontSize: 22, fontWeight: '700' },
  price: { color: c.violet, fontSize: 20, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  meta: { color: c.muted, fontSize: 13 },
  h: { color: c.inkStrong, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  link: { color: c.violet, marginTop: 8 },
  applicant: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
