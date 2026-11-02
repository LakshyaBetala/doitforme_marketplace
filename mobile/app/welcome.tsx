import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Reveal } from '../components/ic/kit';
import { Txt } from '../components/ic/Txt';
import { Button } from '../components/ui';
import { SITE } from '../lib/api';
import { DEMO_ENABLED } from '../lib/demo';
import { useSession } from '../lib/session';
import { c, font, grape } from '../lib/theme';
import { INNER_CIRCLE_ROLES } from '../shared/innerCircle';

const ROLE_ICON = { TECH: 'hammer-outline', OUTREACH: 'paper-plane-outline' } as const;

const FACTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'briefcase-outline', title: 'Company briefs first', body: 'See paid company work before it reaches the open board.' },
  { icon: 'ribbon-outline', title: 'We vouch for you', body: 'We put your name forward directly instead of leaving you in a pile.' },
  { icon: 'shield-checkmark-outline', title: 'Same escrow', body: 'Money is held before you start. Nothing about getting paid changes.' },
];

// The front door for anyone who is signed out: the invitation, who it is for, and the two
// ways in. Written as an invitation, not a sales page (see app/inner-circle/page.tsx).
export default function Welcome() {
  const { top, bottom } = useSafeAreaInsets();
  const { startDemo } = useSession();

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <LinearGradient colors={['#251030', '#351144', '#5b1479']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={s.orbA} />
      <View pointerEvents="none" style={s.orbB} />

      <ScrollView contentContainerStyle={{ paddingTop: top + 18, paddingBottom: bottom + 28, paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        <Reveal i={0} style={s.brand}>
          <Image source={require('../assets/splash-icon.png')} style={s.logo} resizeMode="contain" />
          <Txt v="heading" style={{ color: '#fff', fontSize: 19 }}>DoItForMe</Txt>
        </Reveal>

        <Reveal i={1} style={{ marginTop: 44 }}>
          <View style={s.badge}>
            <View style={s.dot} />
            <Txt v="eyebrow" style={{ color: grape.gold, letterSpacing: 1.6 }}>Invite only</Txt>
          </View>
          <Txt v="hero" style={{ color: '#fff', fontSize: 44, lineHeight: 46, letterSpacing: -1.6, marginTop: 16 }}>
            The Inner{'\n'}Circle.
          </Txt>
          <Txt v="body" style={{ color: 'rgba(255,255,255,0.82)', fontSize: 16.5, lineHeight: 25, marginTop: 16, maxWidth: 340 }}>
            A small group of students we put in front of real companies first. Paid briefs, proper budgets, and work worth putting your name on.
          </Txt>
        </Reveal>

        <Reveal i={2} style={{ marginTop: 30, gap: 12 }}>
          <Button label="Apply to join" icon="arrow-forward" onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })} />
          <Pressable onPress={() => router.push('/login')} style={s.signin} accessibilityRole="button">
            <Txt v="body" style={{ color: '#fff', fontWeight: '700' }}>I am a member. Sign in</Txt>
          </Pressable>
        </Reveal>

        <Reveal i={3} style={{ marginTop: 40 }}>
          <Txt v="eyebrow" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>Two ways in</Txt>
          <View style={{ gap: 12 }}>
            {INNER_CIRCLE_ROLES.map((r) => (
              <View key={r.value} style={s.role}>
                <View style={s.roleIcon}>
                  <Ionicons name={ROLE_ICON[r.value]} size={20} color={grape.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="body" style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                    {r.label} <Txt v="body" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>· {r.tagline}</Txt>
                  </Txt>
                  <Txt v="small" style={{ color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>{r.blurb}</Txt>
                </View>
              </View>
            ))}
          </View>
        </Reveal>

        <Reveal i={4} style={{ marginTop: 34, gap: 18 }}>
          {FACTS.map((f) => (
            <View key={f.title} style={s.fact}>
              <View style={s.factBar} />
              <View style={{ flex: 1 }}>
                <Txt v="body" style={{ color: '#fff', fontWeight: '700' }}>{f.title}</Txt>
                <Txt v="small" style={{ color: 'rgba(255,255,255,0.68)', marginTop: 2 }}>{f.body}</Txt>
              </View>
            </View>
          ))}
        </Reveal>

        {DEMO_ENABLED ? (
          <Reveal i={5} style={s.demo}>
            <Txt v="eyebrow" style={{ color: grape.gold }}>Preview build</Txt>
            <Txt v="small" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>No account needed. Look around with sample data, as each kind of member.</Txt>
            <View style={s.demoRow}>
              {([['Builder', 'TECH'], ['Outreach', 'OUTREACH'], ['Applying', 'APPLICANT'], ['In review', 'PENDING']] as const).map(([label, who]) => (
                <Pressable key={who} onPress={() => startDemo(who)} style={s.demoBtn}>
                  <Txt v="small" style={{ color: '#fff', fontWeight: '700' }}>{label}</Txt>
                </Pressable>
              ))}
            </View>
          </Reveal>
        ) : null}

        <View style={s.legal}>
          {[['Terms', '/terms'], ['Privacy', '/privacy-policy'], ['Help', '/contact']].map(([label, path]) => (
            <Txt key={label} v="small" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }} onPress={() => Linking.openURL(`${SITE}${path}`)}>
              {label}
            </Txt>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#251030' },
  orbA: { position: 'absolute', width: 320, height: 320, borderRadius: 160, right: -120, top: -60, backgroundColor: 'rgba(255,255,255,0.05)' },
  orbB: { position: 'absolute', width: 260, height: 260, borderRadius: 130, left: -110, top: 340, backgroundColor: 'rgba(255,165,30,0.10)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 11 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.orange },
  signin: { minHeight: 50, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  role: { flexDirection: 'row', gap: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  roleIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,210,140,0.14)', alignItems: 'center', justifyContent: 'center' },
  fact: { flexDirection: 'row', gap: 14 },
  factBar: { width: 3, borderRadius: 2, backgroundColor: c.orange },
  demo: { marginTop: 38, padding: 16, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,210,140,0.45)' },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  demoBtn: { flexGrow: 1, flexBasis: '45%', minHeight: 42, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 34 },
});

void font;
