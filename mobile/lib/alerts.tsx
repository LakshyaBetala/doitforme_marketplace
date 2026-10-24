import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { humanize } from './format';
import { useSession } from './session';
import { isDemo, supabase } from './supabase';
import { c, r } from './theme';

// The one global realtime listener (ported from components/RealtimeListener.tsx, extended
// with the unread count the website's NotificationBell shows). Do not add a second one.
type Banner = { title: string; body: string; go: () => void };
type Ctx = { unread: number; markAllRead: () => Promise<void> };
const AlertsCtx = createContext<Ctx>({ unread: 0, markAllRead: async () => {} });
export const useAlerts = () => useContext(AlertsCtx);

// Notification links are website paths; map the ones the app has a screen for.
export function openLink(link: string | null | undefined) {
  if (!link) return;
  const gig = link.match(/^\/(?:gig|company\/task)\/([^/?#]+)/);
  if (gig) return router.push(`/gig/${gig[1]}`);
  if (link.startsWith('/messages') || link.startsWith('/chat')) return router.push('/messages');
  if (link.startsWith('/activity') || link.startsWith('/dashboard')) return router.push('/activity');
  if (link.startsWith('/payouts')) return router.push('/payouts');
  if (link.startsWith('/profile')) return router.push('/profile');
  if (link.startsWith('/verify-id')) return router.push('/verify-id');
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const [unread, setUnread] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const path = useRef('');
  path.current = usePathname();
  const fade = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (b: Banner) => {
      setBanner(b);
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(4500),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setBanner(null));
    },
    [fade],
  );

  const refreshUnread = useCallback(async () => {
    if (!uid) return;
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false);
    setUnread(count ?? 0);
  }, [uid]);

  useEffect(() => {
    if (!uid || isDemo()) return setUnread(0);
    void refreshUnread();
    const ch = supabase
      .channel(`alerts-${uid}`)
      // 1. New messages, unless the person is already reading messages.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${uid}` }, (p: any) => {
        if (path.current.startsWith('/chat') || path.current.startsWith('/messages')) return;
        const m = p.new;
        show({ title: 'New message', body: m.content || 'You have a new message.', go: () => router.push({ pathname: '/chat/[gigId]', params: { gigId: m.gig_id, other: m.sender_id } }) });
      })
      // 2 and 3. Status changes on tasks I posted or am working on.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `poster_id=eq.${uid}` }, (p: any) => {
        if (p.new.status === p.old?.status) return;
        const done = p.new.status === 'completed';
        show({ title: 'Task update', body: done ? `'${p.new.title}' completed. Funds released.` : `'${p.new.title}' is now ${humanize(p.new.status)}`, go: () => router.push(`/gig/${p.new.id}`) });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `assigned_worker_id=eq.${uid}` }, (p: any) => {
        if (p.new.status === p.old?.status) return;
        const body = p.new.status === 'assigned' ? `You have been assigned to '${p.new.title}'!` : p.new.status === 'cancelled' ? `'${p.new.title}' was cancelled.` : `'${p.new.title}' is now ${humanize(p.new.status)}`;
        show({ title: 'Work update', body, go: () => router.push(`/gig/${p.new.id}`) });
      })
      // The bell: a new row in `notifications` bumps the unread count.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => void refreshUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, show, refreshUnread]);

  const markAllRead = useCallback(async () => {
    if (!uid || isDemo()) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false);
    setUnread(0);
  }, [uid]);

  return (
    <AlertsCtx.Provider value={{ unread, markAllRead }}>
      {children}
      {banner ? (
        <Animated.View style={[s.wrap, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          <Pressable
            onPress={() => {
              banner.go();
              setBanner(null);
            }}
            style={s.card}
          >
            <Text style={s.title}>{banner.title}</Text>
            <Text style={s.body} numberOfLines={2}>{banner.body}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </AlertsCtx.Provider>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 48, left: 12, right: 12 },
  card: { backgroundColor: c.rail, borderRadius: r.lg, padding: 14, gap: 2 },
  title: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
});
