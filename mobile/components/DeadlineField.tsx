import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { c, r } from '../lib/theme';

// Optional deadline. Android has only an imperative dialog API (date, then time);
// iOS renders a compact inline picker. Same Date value either way.
export function DeadlineField({ value, onChange }: { value: Date | null; onChange: (d: Date | null) => void }) {
  const openAndroid = () => {
    const start = value ?? new Date(Date.now() + 86400000);
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (_e, date) => {
        if (!date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          onChange: (_e2, time) => {
            if (!time) return;
            const d = new Date(date);
            d.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(d);
          },
        });
      },
    });
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>Deadline (optional)</Text>
      {Platform.OS === 'android' ? (
        <View style={s.row}>
          <Pressable onPress={openAndroid} style={s.field}>
            <Text style={{ color: value ? c.ink : c.faint, fontSize: 16 }}>{value ? value.toLocaleString('en-IN') : 'No deadline'}</Text>
          </Pressable>
          {value ? <Text style={s.clear} onPress={() => onChange(null)}>Clear</Text> : null}
        </View>
      ) : (
        <View style={s.row}>
          <DateTimePicker value={value ?? new Date(Date.now() + 86400000)} mode="datetime" minimumDate={new Date()} onChange={(_e, d) => d && onChange(d)} />
          {value ? <Text style={s.clear} onPress={() => onChange(null)}>Clear</Text> : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { flex: 1, backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: r.md, paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' },
  clear: { color: c.violet, fontWeight: '600', padding: 8 },
});
