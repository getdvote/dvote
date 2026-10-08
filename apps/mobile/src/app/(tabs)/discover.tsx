import MapsSearchIcon from '@hugeicons/core-free-icons/MapsSearchIcon';
import { Icon } from '../../components/Icon';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { Screen } from '../../components/ui';
import { theme } from '../../lib/theme';

/** Explore shops (tab shown as "Explore"). Needs GET /api/app/vendors, not built yet. */
export default function Discover() {
  return (
    <Screen>
      <Text style={styles.title}>Explore</Text>
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Icon icon={MapsSearchIcon} size={36} color={theme.text} />
        </View>
        <Text style={styles.heading}>Coffee shops near you</Text>
        <Text style={styles.text}>Soon you'll find every dvote shop here, with its rewards and points rule.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 34, fontWeight: '700', color: theme.text, paddingHorizontal: theme.gutter, paddingTop: 12 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, paddingBottom: 80 },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 20, fontWeight: '700', color: theme.text },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21 },
});
