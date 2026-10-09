import GiftCard02Icon from '@hugeicons/core-free-icons/GiftCard02Icon';
import MapsSearchIcon from '@hugeicons/core-free-icons/MapsSearchIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import User02Icon from '@hugeicons/core-free-icons/User02Icon';
import { Icon, type AppIcon } from '../../components/Icon';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, type TKey } from '../../i18n';
import { haptics } from '../../lib/haptics';
import { useSession } from '../../lib/session';
import { theme, squircle } from '../../lib/theme';

// Untitled UI icons are outline-only: the selected tab is shown by colour and its grey pill.
const ICONS: Record<string, { icon: AppIcon; label: TKey }> = {
  cards: { icon: GiftCard02Icon, label: 'tabs.cards' },
  discover: { icon: MapsSearchIcon, label: 'tabs.explore' },
  you: { icon: User02Icon, label: 'tabs.profile' },
};

/** Floating pill with 3 tabs + a separate round QR button (side-menu design). */
function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // A screen can hide the bar (My cards does while its card stack is open).
  const style = descriptors[state.routes[state.index].key]?.options.tabBarStyle;
  if ((StyleSheet.flatten(style) as { display?: string } | undefined)?.display === 'none') return null;
  const { t, rtl } = useI18n();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12), direction: rtl ? 'rtl' : 'ltr' }]}
    >
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
                accessibilityLabel={t(icon.label)}
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    haptics.tab();
                    navigation.navigate(route.name);
                  }
                }}
                style={[styles.tab, focused && styles.tabOn]}
              >
                <Icon icon={icon.icon} size={24} color={focused ? theme.link : theme.text} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.showMyQr')}
          onPress={() => {
            haptics.qr();
            router.push('/qr');
          }}
          style={styles.qr}
        >
          <Icon icon={QrCodeIcon} size={24} color={theme.text} />
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
    ...squircle,
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
