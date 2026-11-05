import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { c, font, grape, lift, r } from '../lib/theme';
import { Tone } from '../lib/format';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body: StyleProp<ViewStyle>[] = [s.card, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
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

type Variant = 'primary' | 'ghost' | 'dark' | 'outline';

// Primary is the website's orange CTA with grape text (see app/inner-circle/page.tsx).
export function Button({ label, onPress, loading, variant = 'primary', icon, disabled }: {
  label: string; onPress: () => void; loading?: boolean; variant?: Variant; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean;
}) {
  const look = {
    primary: { bg: c.orange, fg: grape.onAccent, border: c.orange },
    dark: { bg: c.rail, fg: '#fff', border: c.rail },
    ghost: { bg: c.violetSoft, fg: c.violet, border: c.violetSoft },
    outline: { bg: 'transparent', fg: c.inkStrong, border: c.line },
  }[variant];
  const off = loading || disabled;
  return (
    <Pressable
      onPress={() => { tick(); onPress(); }}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: look.bg, borderColor: look.border },
        variant === 'primary' && lift,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={s.btnRow}>
          <Text style={[s.btnText, { color: look.fg }]}>{label}</Text>
          {icon ? <Ionicons name={icon} size={18} color={look.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.empty}>
      {icon ? (
        <View style={s.emptyIcon}>
          <Ionicons name={icon} size={24} color={c.violet} />
        </View>
      ) : null}
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
  card: { backgroundColor: c.raised, borderRadius: r.lg, borderWidth: 1, borderColor: c.line, padding: 16, ...lift },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontFamily: font.bold },
  btn: { minHeight: 50, borderRadius: r.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 15.5, fontFamily: font.bold },
  empty: { padding: 32, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: c.violetSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { color: c.inkStrong, fontSize: 18, fontFamily: font.displayHeavy, textAlign: 'center', letterSpacing: -0.3 },
  emptyHint: { color: c.muted, fontSize: 14, lineHeight: 21, marginTop: 4, textAlign: 'center', fontFamily: font.regular, maxWidth: 300 },
});
