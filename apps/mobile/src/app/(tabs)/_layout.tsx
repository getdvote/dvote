import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../lib/session';
import { theme } from '../../lib/theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  cards: { on: 'card', off: 'card-outline', label: 'Cards' },
  discover: { on: 'earth', off: 'earth-outline', label: 'Discover' },
  you: { on: 'person', off: 'person-outline', label: 'You' },
};

/** Floating pill with 3 tabs + a separate round QR button (side-menu design). */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(242,242,247,0)', 'rgba(242,242,247,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <View style={styles.pill}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const icon = ICONS[route.name];
            if (!icon) return null;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={icon.label}
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={[styles.tab, focused && styles.tabOn]}
              >
                <Ionicons name={focused ? icon.on : icon.off} size={23} color={focused ? theme.link : theme.text} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show my QR code"
          onPress={() => router.push('/qr')}
          style={styles.qr}
        >
          <Ionicons name="qr-code-outline" size={24} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { loading, session } = useSession();
  if (!loading && !session) return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.background } }} tabBar={(p) => <FloatingTabBar {...p} />}>
      <Tabs.Screen name="cards" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 28, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 32,
    padding: 5,
    gap: 4,
    ...shadow,
  },
  tab: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: theme.fill },
  qr: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
});
