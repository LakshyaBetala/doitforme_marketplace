import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../lib/session';
import { c, font } from '../../lib/theme';

const icon = (on: keyof typeof Ionicons.glyphMap, off: keyof typeof Ionicons.glyphMap) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? on : off} color={color as string} size={size} />
  );

// The whole signed-in app. The tab bar is the website's grape rail with the orange accent,
// and shows only what this member can use: builders get Briefs and Messages, outreach members
// get Pipeline, and anyone who has not been approved sees just the Circle and their account.
export default function InnerCircleTabs() {
  const { profile } = useSession();
  const { bottom } = useSafeAreaInsets();
  const member = Boolean(profile?.is_elite);
  const role = profile?.inner_circle_role;
  const tech = member && role === 'TECH';
  const outreach = member && role === 'OUTREACH';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.page },
        tabBarActiveTintColor: c.orange,
        tabBarInactiveTintColor: '#ad8eb9',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 11, lineHeight: 14, marginTop: 2 },
        tabBarStyle: { backgroundColor: c.rail, borderTopWidth: 0, height: 78 + bottom, paddingTop: 10, paddingBottom: bottom > 0 ? bottom : 14 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Circle', tabBarIcon: icon('sparkles', 'sparkles-outline') }} />
      <Tabs.Screen name="work" options={{ title: 'Briefs', href: tech ? undefined : null, tabBarIcon: icon('hammer', 'hammer-outline') }} />
      <Tabs.Screen name="outreach" options={{ title: 'Pipeline', href: outreach ? undefined : null, tabBarIcon: icon('paper-plane', 'paper-plane-outline') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', href: tech ? undefined : null, tabBarIcon: icon('chatbubble', 'chatbubble-outline') }} />
      <Tabs.Screen name="me" options={{ title: 'Account', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
