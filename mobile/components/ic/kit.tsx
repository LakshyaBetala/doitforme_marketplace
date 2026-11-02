import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlerts } from '../../lib/alerts';
import { c, font, grape, lift, r } from '../../lib/theme';
import { Txt } from './Txt';

// Fade and rise into place. Wrap each section with a growing `i` for a staggered entrance.
export function Reveal({ i = 0, children, style }: { i?: number; children: ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay: 70 * i, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, i]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function Bell({ tint = c.inkStrong, bg = c.raised }: { tint?: string; bg?: string }) {
  const { unread } = useAlerts();
  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityLabel="Notifications" style={[s.bell, { backgroundColor: bg }]}>
      <Ionicons name="notifications-outline" size={20} color={tint} />
      {unread > 0 ? (
        <View style={s.badge}>
          <Txt v="caption" style={{ color: grape.onAccent, fontSize: 10, fontWeight: '700', lineHeight: 12 }}>{unread > 9 ? '9+' : unread}</Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

// Title block for the top of a tab screen: sits on the cream page, below the status bar.
export function ScreenHeader({ eyebrow, title, subtitle, right = <Bell /> }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top + 14, paddingHorizontal: 20, paddingBottom: 6 }}>
      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Txt v="eyebrow">{eyebrow}</Txt> : null}
          <Txt v="title" style={{ marginTop: 4 }}>{title}</Txt>
        </View>
        {right}
      </View>
      {subtitle ? <Txt v="small" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 22 }}>{subtitle}</Txt> : null}
    </View>
  );
}

// The grape gradient panel used for the Inner Circle hero. `fill` rounds all four corners.
export function Hero({ children, style, bleed }: { children: ReactNode; style?: ViewStyle; bleed?: boolean }) {
  return (
    <LinearGradient colors={grape.colors} start={grape.start} end={grape.end} style={[s.hero, bleed && s.heroBleed, style]}>
      <View pointerEvents="none" style={s.orbA} />
      <View pointerEvents="none" style={s.orbB} />
      {children}
    </LinearGradient>
  );
}

export function Stat({ label, value, tone = 'ink' }: { label: string; value: string | number; tone?: 'ink' | 'orange' | 'bad' | 'ok' }) {
  const color = { ink: c.inkStrong, orange: c.orangeInk, bad: c.bad, ok: c.ok }[tone];
  return (
    <View style={s.stat}>
      <Txt v="num" style={{ color }}>{value}</Txt>
      <Txt v="caption" style={{ marginTop: 2 }}>{label}</Txt>
    </View>
  );
}

export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={s.seg}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => { void Haptics.selectionAsync().catch(() => {}); onChange(it.key); }}
            style={[s.segItem, on && s.segOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Txt v="small" style={{ color: on ? '#fff' : c.muted, fontWeight: '700', fontSize: 13.5 }}>
              {it.label}
              {it.count != null ? `  ${it.count}` : ''}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// A row of icon + title + detail, used for the "what membership means" lists.
export function Fact({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={s.fact}>
      <View style={s.factIcon}>
        <Ionicons name={icon} size={18} color={c.orangeInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="body" style={{ fontWeight: '700', color: c.inkStrong }}>{title}</Txt>
        <Txt v="small" style={{ marginTop: 2 }}>{body}</Txt>
      </View>
    </View>
  );
}

export function Progress({ value, total, color = c.violet }: { value: number; total: number; color?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <View style={s.track}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bell: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  hero: { borderRadius: 22, padding: 22, overflow: 'hidden' },
  heroBleed: { borderRadius: 0, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  orbA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -80, backgroundColor: 'rgba(255,255,255,0.07)' },
  orbB: { position: 'absolute', width: 140, height: 140, borderRadius: 70, left: -50, bottom: -70, backgroundColor: 'rgba(255,165,30,0.14)' },
  stat: { flex: 1, backgroundColor: c.raised, borderRadius: r.lg, borderWidth: 1, borderColor: c.line, paddingVertical: 14, paddingHorizontal: 14, ...lift },
  seg: { flexDirection: 'row', backgroundColor: c.violetSoft, borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: c.violet },
  fact: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  factIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' },
});

void font;
