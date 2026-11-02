import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { INNER_CIRCLE_ONLY } from '../../lib/config';
import { c } from '../../lib/theme';
import { useAlerts } from '../../lib/alerts';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

function Bell() {
  const { unread } = useAlerts();
  return (
    <Pressable onPress={() => router.push('/notifications')} style={{ paddingHorizontal: 16 }} hitSlop={10}>
      <Ionicons name="notifications-outline" size={24} color={c.violet} />
      {unread > 0 ? (
        <View style={{ position: 'absolute', top: -4, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: c.inkStrong, fontSize: 11, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}


const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

function TabsLayoutInner() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.violet,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.raised, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.page },
        headerTitleStyle: { color: c.inkStrong, fontWeight: '700' },
        headerShadowVisible: false,
        headerRight: () => <Bell />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="feed" options={{ title: 'Find tasks', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="post" options={{ title: 'Post', tabBarIcon: icon('add-circle-outline') }} />
      {/* My work stays reachable (Home links to it) but keeps the bottom bar to five items. */}
      <Tabs.Screen name="activity" options={{ title: 'My work', href: null }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chatbubble-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}

// The student and business screens are kept in the repo but hidden in the Inner Circle build.
export default function TabsLayout() {
  return INNER_CIRCLE_ONLY ? <Redirect href="/inner-circle" /> : <TabsLayoutInner />;
}
