import { Text as RNText, StyleSheet, TextProps } from 'react-native';
import { font, fontFor } from '../../lib/theme';

// Drop-in for react-native's Text that renders in DM Sans. Android ignores fontWeight on custom
// font families, so a weight in `style` is translated to the matching DM Sans file. This is how
// the older screens (task detail, chat, payouts, ...) pick up the brand font without edits to
// every style.
export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weighted = !flat.fontFamily && flat.fontWeight ? { fontFamily: fontFor(flat.fontWeight), fontWeight: undefined } : null;
  return <RNText {...rest} style={[{ fontFamily: font.regular }, style, weighted]} />;
}
