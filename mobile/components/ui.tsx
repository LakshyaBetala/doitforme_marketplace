import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { c, r } from '../lib/theme';
import { Tone } from '../lib/format';

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const body = [s.card, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: c.violetSoft, fg: c.violet },
  ok: { bg: c.okSoft, fg: c.ok },
  warn: { bg: c.orangeSoft, fg: c.orangeInk },
  bad: { bg: c.badSoft, fg: c.bad },
};

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[s.pill, { backgroundColor: t.bg }]}>
      <Text style={[s.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, loading, variant = 'primary' }: {
  label: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'ghost';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnGhost, pressed && { opacity: 0.8 }]}
    >
      {loading ? <ActivityIndicator color={primary ? '#fff' : c.violet} /> : (
        <Text style={[s.btnText, { color: primary ? '#fff' : c.violet }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {hint ? <Text style={s.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={c.violet} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: c.raised, borderRadius: r.lg, borderWidth: 1, borderColor: c.line, padding: 16 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  btn: { minHeight: 48, borderRadius: r.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: c.violet },
  btnGhost: { backgroundColor: c.violetSoft },
  btnText: { fontSize: 15, fontWeight: '700' },
  empty: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: c.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyHint: { color: c.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
