import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text } from 'react-native';
import { ErrorText } from '../components/form';
import { Button, Card } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { c } from '../lib/theme';

// Same upload as app/verify-id/page.tsx: multipart POST to /api/kyc/upload, which stores
// the photo privately and auto-checks it. Any student ID is valid: school, college, university.
export default function VerifyId() {
  const { reload } = useSession();
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(camera: boolean) {
    setErr('');
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr(camera ? 'Camera permission is needed to take a photo.' : 'Photo access is needed to pick an image.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5 }; // the API refuses files over 5 MB
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setUri(res.assets[0].uri);
  }

  async function upload() {
    if (!uri) return;
    setBusy(true);
    setErr('');
    const form = new FormData();
    // React Native's FormData takes this { uri, name, type } shape instead of a File.
    form.append('file', { uri, name: 'student-id.jpg', type: 'image/jpeg' } as any);
    const res = await api<{ decision?: string; reason?: string }>('/api/kyc/upload', { form });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? 'Upload failed. Try a clearer photo.');
    await reload();
    const d = res.data?.decision;
    Alert.alert(
      d === 'approved' ? 'Verified' : d === 'rejected' ? 'Not accepted' : 'Under review',
      d === 'approved' ? 'Your student ID is verified.' : d === 'rejected' ? (res.data?.reason ?? 'We could not accept this photo. Try a clearer one.') : 'A person will review it shortly.',
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ headerShown: true, title: 'Verify student ID', headerTintColor: c.violet, headerStyle: { backgroundColor: c.page } }} />
      <Card style={{ gap: 6 }}>
        <Text style={s.h}>Why verify?</Text>
        <Text style={s.body}>Company tasks are open to verified students only. Any student ID works: school, college or university. Make sure your name and institution are readable.</Text>
      </Card>
      {uri ? <Image source={{ uri }} style={s.preview} resizeMode="contain" /> : null}
      <Button label="Take a photo" onPress={() => pick(true)} />
      <Button label="Choose from gallery" variant="ghost" onPress={() => pick(false)} />
      <ErrorText>{err}</ErrorText>
      {uri ? <Button label="Upload for verification" loading={busy} onPress={upload} /> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { color: c.inkStrong, fontSize: 15, fontWeight: '700' },
  body: { color: c.ink, fontSize: 15, lineHeight: 22 },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: c.violetSoft },
});
