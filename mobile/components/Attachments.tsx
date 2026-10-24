import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { attachmentLabel, isImageAttachment } from '../shared/attachments';
import { supabase } from '../lib/supabase';
import { c, r } from '../lib/theme';

// Images show as a gallery, everything else as a download card, decided by extension
// (shared/attachments.ts, the website's own rule).
export function Attachments({ paths }: { paths: string[] }) {
  if (!paths.length) return null;
  const url = (p: string) => supabase.storage.from('gig-images').getPublicUrl(p).data.publicUrl;
  const images = paths.filter(isImageAttachment);
  const docs = paths.filter((p) => !isImageAttachment(p));
  return (
    <View style={{ gap: 10 }}>
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((p) => (
            <Image key={p} source={{ uri: url(p) }} style={s.img} />
          ))}
        </ScrollView>
      ) : null}
      {docs.map((p) => (
        <Pressable key={p} onPress={() => Linking.openURL(url(p))} style={s.doc}>
          <Text style={s.tag}>{attachmentLabel(p)}</Text>
          <Text style={s.name} numberOfLines={1}>
            {decodeURIComponent(p.split('/').pop() ?? p).replace(/^\d+_/, '')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  img: { width: 220, height: 160, borderRadius: 12, backgroundColor: c.violetSoft },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: r.md, padding: 12 },
  tag: { color: c.violet, backgroundColor: c.violetSoft, fontWeight: '700', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  name: { flex: 1, color: c.ink, fontSize: 14 },
});
