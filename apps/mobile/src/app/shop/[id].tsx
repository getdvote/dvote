import Coins01Icon from '@hugeicons/core-free-icons/Coins01Icon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DvoteLogo } from '../../components/DvoteLogo';
import { MenuGallery } from '../../components/MenuGallery';
import { Text } from '../../components/Text';
import { EmptySection, PageHeader, Screen, SectionTitle } from '../../components/ui';
import { theme, vendorColors } from '../../lib/theme';

/**
 * Shop page (opened from Card details → Issued by). Name and logo come in the route params,
 * so the page shows them at once.
 *
 * Not in the backend yet, so shown as placeholders / empty states:
 * - header image: vendors have no cover image field, so the banner uses the shop's colour
 *   (same as its card); pass `coverUrl` once the API has one and the photo is shown instead;
 * - points rule, rewards and branches: need GET /api/app/vendors/{id};
 * - menu: shown as the shop's menu-page images; there is no menu table yet, so `menuImages`
 *   is empty and the section shows its empty state.
 */
export default function Shop() {
  const { id, name, logoUrl, coverUrl } = useLocalSearchParams<{
    id: string;
    name?: string;
    logoUrl?: string;
    coverUrl?: string;
  }>();
  const shopName = name || 'Shop';
  const menuImages: string[] = []; // TODO: from GET /api/app/vendors/{id} once menus exist
  const colors = vendorColors(id ?? '');

  return (
    <Screen>
      <PageHeader title={shopName} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
              {/* faint dvote petals, like the cards */}
              <View style={styles.pattern} pointerEvents="none">
                <DvoteLogo height={220} wordmark={false} color="rgba(255,255,255,0.10)" />
              </View>
            </LinearGradient>
          )}
        </View>

        <View style={styles.hero}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="contain" />
          ) : (
            <View style={[styles.logo, { backgroundColor: colors[0] }]}>
              <Text style={styles.logoInitial}>{shopName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{shopName}</Text>
        </View>

        <SectionTitle title="How you earn points" />
        <EmptySection
          icon={Coins01Icon}
          title="Points rule coming soon"
          text="You'll see how many points you get for every amount you spend here."
        />

        <SectionTitle title="Rewards" />
        <EmptySection
          icon={GiftIcon}
          title="Rewards coming soon"
          text="Every reward at this shop and its points will show here."
        />

        <SectionTitle title="Menu" />
        <MenuGallery images={menuImages} />

        <SectionTitle title="Branches" />
        <EmptySection
          icon={Location01Icon}
          title="Branches coming soon"
          text="This shop's branches and where to find them will show here."
        />
      </ScrollView>
    </Screen>
  );
}

const LOGO_SIZE = 88;

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: 40 },
  banner: { height: 160, borderRadius: theme.radius, overflow: 'hidden', backgroundColor: theme.fill },
  pattern: { position: 'absolute', right: -40, top: -20 },
  // The logo overlaps the bottom of the banner.
  hero: { alignItems: 'center', gap: 10, marginTop: -LOGO_SIZE / 2 },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 4,
    borderColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  logoInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 24, fontWeight: '700', color: theme.text, textAlign: 'center' },
});
