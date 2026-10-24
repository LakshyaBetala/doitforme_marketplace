import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLLEGES } from '../shared/colleges';
import { c, r } from '../lib/theme';
import { Field } from './form';

// The website's list (shared/colleges.ts). "My campus" filters by exact string match on
// users.college, so free text would silently split a campus in two. "Other" lets someone
// type a name that is not on the list, as on the website.
export function CollegePicker({ value, onChange, label = 'College' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inList = COLLEGES.includes(value);
  const [other, setOther] = useState(!!value && !inList);
  const items = useMemo(() => COLLEGES.filter((x) => x.toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={s.field}>
        <Text style={{ color: value ? c.ink : c.faint, fontSize: 16 }}>{other ? 'Other' : value || 'Select your college'}</Text>
      </Pressable>
      {other ? <Field label="College name" value={inList ? '' : value} onChangeText={onChange} /> : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.wrap}>
          <View style={s.head}>
            <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={c.faint} autoFocus />
            <Text style={s.close} onPress={() => setOpen(false)}>Close</Text>
          </View>
          <FlatList
            data={items}
            keyExtractor={(x) => x}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={s.row}
                onPress={() => {
                  setOpen(false);
                  setQ('');
                  if (item === 'Other') {
                    setOther(true);
                    onChange('');
                  } else {
                    setOther(false);
                    onChange(item);
                  }
                }}
              >
                <Text style={[s.item, item === value && { color: c.violet, fontWeight: '700' }]}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  field: { backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: r.md, paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' },
  wrap: { flex: 1, backgroundColor: c.page, paddingTop: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  search: { flex: 1, backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: r.md, paddingHorizontal: 14, minHeight: 46, fontSize: 16, color: c.ink },
  close: { color: c.violet, fontWeight: '600', padding: 6 },
  row: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  item: { color: c.ink, fontSize: 16 },
});
