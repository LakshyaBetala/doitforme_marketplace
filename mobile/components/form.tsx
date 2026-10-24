import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { c, r } from '../lib/theme';

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={c.faint}
        {...props}
        style={[s.input, props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }, props.style]}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

// Bottom sheet used for every action form (apply, deliver, request changes...).
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Text style={s.close} onPress={onClose}>
              Close
            </Text>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ErrorText({ children }: { children?: string }) {
  return children ? <Text style={s.error}>{children}</Text> : null;
}

const s = StyleSheet.create({
  label: { color: c.inkStrong, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: r.md, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: c.ink },
  hint: { color: c.muted, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(45,25,55,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.page, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: c.inkStrong, fontSize: 18, fontWeight: '700' },
  close: { color: c.violet, fontWeight: '600', padding: 6 },
  error: { color: c.bad, fontSize: 14 },
});
