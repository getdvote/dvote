import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { View } from 'react-native';
import { isRtl } from '../i18n';
import { theme } from '../lib/theme';

/**
 * An icon from Hugeicons (free "stroke rounded" set, @hugeicons/core-free-icons), the app's
 * icon set, drawn by the official @hugeicons/react-native component. Import each icon on its
 * own so only the used ones are bundled:
 *
 *   import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
 *   <Icon icon={GiftIcon} size={20} color={theme.text} />
 *
 * Browse the set at https://hugeicons.com/icons (filter: Free, Stroke Rounded).
 */
export type AppIcon = IconSvgElement;

export function Icon({
  icon,
  size = 20,
  color = theme.text,
  strokeWidth = 2,
  mirror = false,
}: {
  icon: AppIcon;
  size?: number;
  color?: string;
  /** App standard: 2 px lines on Hugeicons' 24 px grid (their own default is 1.5). */
  strokeWidth?: number;
  /** Directional icons (back / forward arrows): flipped when the app is right-to-left (Arabic). */
  mirror?: boolean;
}) {
  const drawn = <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} pointerEvents="none" />;
  return mirror && isRtl() ? (
    <View style={{ transform: [{ scaleX: -1 }] }} pointerEvents="none">
      {drawn}
    </View>
  ) : (
    drawn
  );
}
