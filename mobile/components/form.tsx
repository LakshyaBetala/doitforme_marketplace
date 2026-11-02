import { ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { c, font, r } from '../lib/theme';

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={c.faint}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[s.input, focus && s.focus, props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }, props.style]}
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
          <View style={s.grab} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Text style={s.close} onPress={onClose}>
              Close
            </Text>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 28 }}>
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
  label: { color: c.inkStrong, fontSize: 13.5, fontFamily: font.bold },
  input: { backgroundColor: c.raised, borderColor: c.line, borderWidth: 1.5, borderRadius: r.md, paddingHorizontal: 14, minHeight: 50, fontSize: 16, color: c.ink, fontFamily: font.regular },
  focus: { borderColor: c.violet },
  hint: { color: c.muted, fontSize: 12, fontFamily: font.regular },
  backdrop: { flex: 1, backgroundColor: 'rgba(37,16,48,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.page, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingTop: 10, maxHeight: '90%' },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { color: c.inkStrong, fontSize: 20, fontFamily: font.displayHeavy, letterSpacing: -0.4 },
  close: { color: c.violet, fontFamily: font.bold, padding: 6 },
  error: { color: c.bad, fontSize: 14, fontFamily: font.medium },
});
