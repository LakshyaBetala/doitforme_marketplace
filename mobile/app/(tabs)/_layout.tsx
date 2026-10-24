import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { c } from '../../lib/theme';

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.violet,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.raised, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.page },
        headerTitleStyle: { color: c.inkStrong, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Find tasks', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="activity" options={{ title: 'My work', tabBarIcon: icon('briefcase-outline') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chatbubble-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
