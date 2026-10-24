import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { c, r } from '../../lib/theme';

// One conversation = one gig + one other person, like components/chat/MessagesView.tsx.
// Reading goes straight to Supabase (RLS); sending goes through /api/chat/send because
// that route is where server-side moderation (phone/UPI leakage) and the pre-agreement
// message cap live. Never insert into `messages` from here.
export default function Chat() {
  const { gigId, other, name } = useLocalSearchParams<{ gigId: string; other: string; name?: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const list = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('gig_id', gigId)
      .or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`)
      .order('created_at', { ascending: true });
    setMsgs(data ?? []);
    setLoading(false);
  }, [me, gigId, other]);

  useEffect(() => {
    void load();
    // Realtime is a delivery optimisation; the poll is the guarantee (sockets are
    // suspended while the app is backgrounded).
    const ch = me
      ? supabase
          .channel(`chat-${gigId}-${other}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` }, () => void load())
          .subscribe()
      : null;
    const poll = setInterval(() => void load(), 8000);
    return () => {
      clearInterval(poll);
      if (ch) supabase.removeChannel(ch);
    };
  }, [load, me, gigId, other]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setErr('');
    const res = await api('/api/chat/send', { body: { gigId, receiverId: other, content } });
    setSending(false);
    if (!res.ok) return setErr(res.error ?? 'Message not sent.');
    setText('');
    await load();
  }

  if (loading) return <Loading />;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ headerShown: true, title: name ?? 'Chat', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={s.empty}>Say hello. Keep payment and contact details on DoItForMe.</Text>}
        renderItem={({ item }) => {
          if (item.message_type === 'system') return <Text style={s.system}>{item.content === 'LOCATION_ALERT' ? 'Location shared' : item.content}</Text>;
          const mine = item.sender_id === me;
          return (
            <View style={[s.bubble, mine ? s.mine : s.theirs]}>
              <Text style={[s.msg, mine && { color: '#fff' }]}>{item.content}</Text>
              <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.7)' }]}>{timeAgo(item.created_at)}</Text>
            </View>
          );
        }}
      />
      {err ? <Text style={s.err}>{err}</Text> : null}
      <View style={s.bar}>
        <TextInput style={s.input} value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={c.faint} multiline />
        <Pressable onPress={send} disabled={sending || !text.trim()} style={[s.send, (!text.trim() || sending) && { opacity: 0.45 }]}>
          <Text style={s.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  empty: { color: c.muted, textAlign: 'center', marginTop: 40 },
  system: { color: c.muted, textAlign: 'center', fontSize: 12 },
  bubble: { maxWidth: '82%', borderRadius: r.lg, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: c.violet },
  theirs: { alignSelf: 'flex-start', backgroundColor: c.raised, borderWidth: 1, borderColor: c.line },
  msg: { color: c.ink, fontSize: 15, lineHeight: 21 },
  time: { color: c.faint, fontSize: 11, marginTop: 2 },
  err: { color: c.bad, paddingHorizontal: 16, paddingBottom: 4 },
  bar: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface, alignItems: 'flex-end' },
  input: { flex: 1, maxHeight: 110, minHeight: 44, backgroundColor: c.raised, borderRadius: r.md, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, fontSize: 16, color: c.ink },
  send: { minHeight: 44, paddingHorizontal: 16, borderRadius: r.md, backgroundColor: c.violet, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '700' },
});
