import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { c, font, grape } from '../../lib/theme';

// Opening animation. It starts pixel-identical to the native splash (same grape colour, same
// logo, same width as the expo-splash-screen plugin's imageWidth in app.json), so the handover
// from native to JS is invisible. Then the logo settles, a ring pulses out, the wordmark rises,
// and the whole layer fades away once `ready` (fonts + session) is true and the minimum
// show time has passed.
const LOGO = 168;
const MIN_MS = 1700;

export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const started = useRef(Date.now());
  const leaving = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logo, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(word, { toValue: 1, duration: 600, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [logo, ring, word]);

  useEffect(() => {
    if (!ready || leaving.current) return;
    leaving.current = true;
    const wait = Math.max(0, MIN_MS - (Date.now() - started.current));
    const t = setTimeout(() => {
      Animated.timing(out, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(onDone);
    }, wait);
    return () => clearTimeout(t);
  }, [ready, out, onDone]);

  return (
    <Animated.View style={[s.wrap, { opacity: out }]} pointerEvents="auto">
      <Animated.View
        style={[s.ring, { opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.1] }) }] }]}
      />
      <Animated.View style={{ transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] }}>
        <Image source={require('../../assets/splash-icon.png')} style={{ width: LOGO, height: LOGO }} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: '50%', marginTop: LOGO / 2 + 6, alignItems: 'center', opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Animated.Text style={s.name}>DoItForMe</Animated.Text>
        <View style={s.rule} />
        <Animated.Text style={s.tag}>THE INNER CIRCLE</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#341044', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  ring: { position: 'absolute', width: LOGO, height: LOGO, borderRadius: LOGO / 2, borderWidth: 2, borderColor: c.orange },
  name: { color: '#fff', fontFamily: font.displayHeavy, fontSize: 30, letterSpacing: -0.8 },
  rule: { width: 28, height: 3, borderRadius: 2, backgroundColor: c.orange, marginVertical: 10 },
  tag: { color: grape.gold, fontFamily: font.bold, fontSize: 12, letterSpacing: 3 },
});
