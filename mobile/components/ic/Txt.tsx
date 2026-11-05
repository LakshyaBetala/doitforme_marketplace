import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { c, font, fontFor } from '../../lib/theme';

// The one Text primitive for the Inner Circle screens. Headings use Manrope (the
// website's display face); everything else uses DM Sans. A fontWeight in `style` is
// translated to the matching DM Sans file, because Android ignores fontWeight on
// custom families.
type Variant = 'hero' | 'title' | 'heading' | 'body' | 'small' | 'caption' | 'eyebrow' | 'num';

const base: Record<Variant, TextStyle> = {
  hero: { fontFamily: font.displayHeavy, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: c.inkStrong },
  title: { fontFamily: font.displayHeavy, fontSize: 26, lineHeight: 30, letterSpacing: -0.7, color: c.inkStrong },
  heading: { fontFamily: font.displayHeavy, fontSize: 18, lineHeight: 23, letterSpacing: -0.1, color: c.inkStrong },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 23, color: c.ink },
  small: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 20, color: c.muted },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: c.faint },
  eyebrow: { fontFamily: font.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, color: c.faint, textTransform: 'uppercase' },
  num: { fontFamily: font.displayHeavy, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: c.inkStrong },
};

export function Txt({ v = 'body', style, children, ...rest }: TextProps & { v?: Variant; children?: ReactNode; style?: StyleProp<TextStyle> }) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weighted = flat.fontWeight && !flat.fontFamily ? { fontFamily: fontFor(flat.fontWeight), fontWeight: undefined } : null;
  return (
    <Text {...rest} style={[base[v], style, weighted]}>
      {children}
    </Text>
  );
}
