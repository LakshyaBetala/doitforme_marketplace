import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { humanize, rupees, timeAgo } from '../lib/format';
import { c } from '../lib/theme';
import { Card, Pill } from './ui';

export function GigCard({ gig }: { gig: any }) {
  const company = gig.companies?.name;
  return (
    <Card onPress={() => router.push(`/gig/${gig.id}`)} style={{ gap: 8 }}>
      <View style={s.row}>
        <Text style={s.title} numberOfLines={2}>{gig.title}</Text>
        <Text style={s.price}>{rupees(gig.price)}</Text>
      </View>
      <View style={[s.row, { justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }]}>
        {gig.is_featured ? <Pill label="Featured" tone="warn" /> : null}
        {gig.listing_type === 'COMPANY_TASK' ? <Pill label={company ?? 'Company'} /> : null}
        {gig.category ? <Pill label={humanize(gig.category)} /> : null}
      </View>
      <Text style={s.meta}>
        {timeAgo(gig.created_at)}
        {typeof gig.applicant_count === 'number' ? ` · ${gig.applicant_count} applied` : ''}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, color: c.inkStrong, fontSize: 16, fontWeight: '700' },
  price: { color: c.violet, fontSize: 16, fontWeight: '700' },
  meta: { color: c.muted, fontSize: 13 },
});
