import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import ViewOffSlashIcon from '@hugeicons/core-free-icons/ViewOffSlashIcon';
import { Icon, type AppIcon } from './Icon';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from './Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { theme, squircle } from '../lib/theme';


/** Pushed page: round back button + centred title (Profile details, Settings, About…). */
export function PageHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.pageHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/you')))}
        style={styles.backButton}
        hitSlop={8}
      >
        <Icon icon={ArrowLeft01Icon} size={24} color={theme.text} mirror />
      </Pressable>
      <Text style={styles.pageTitle} numberOfLines={1}>
        {title}
      </Text>
      {/* same width as the back button so the title stays centred */}
      <View style={styles.headerSpacer} />
    </View>
  );
}

export function Screen({
  children,
  edges = ['top'],
  style,
}: {
  children: ReactNode;
  edges?: ('top' | 'bottom')[];
  style?: StyleProp<ViewStyle>;
}) {
  // Arabic lays the whole page out right-to-left (rows, margins with start/end, arrows).
  const { rtl } = useI18n();
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { direction: rtl ? 'rtl' : 'ltr' }, style]}>
      {children}
    </SafeAreaView>
  );
}

/** White rounded section with hairline separators between its rows. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {child}
          {i < items.length - 1 ? <View style={styles.separator} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Grey section heading, optionally with a link on the other side ("View all"). */
export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  if (!action) return <Text style={styles.sectionTitle}>{title}</Text>;
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={action.onPress}
        style={({ pressed }) => pressed && styles.rowPressed}
      >
        <Text style={styles.sectionAction}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

/** A row: optional icon, label, optional value, chevron when it navigates. */
export function Row({
  label,
  icon,
  value,
  onPress,
  right,
  disabled,
}: {
  label: string;
  icon?: AppIcon;
  value?: string | null;
  onPress?: () => void;
  right?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
    >
      {icon ? (
        <View style={styles.rowIcon}>
          <Icon icon={icon} size={20} color={theme.text} />
        </View>
      ) : null}
      <Text style={[styles.rowLabel, disabled && styles.disabledText]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} mirror /> : null}
    </Pressable>
  );
}

/** Small grey "Soon" tag for features whose backend isn't ready yet. */
export function SoonTag() {
  const { t } = useI18n();
  return (
    <View style={styles.soon}>
      <Text style={styles.soonText}>{t('common.soon')}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.primary, style, inactive && styles.inactive, pressed && !inactive && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

/**
 * White pill button (secondary), e.g. "Logout" in red on Settings. `badge` sits after the
 * title (e.g. <SoonTag />); `disabled` dims it for features that aren't available yet.
 */
export function PillButton({
  title,
  onPress,
  color = theme.text,
  icon,
  badge,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.pill, style, pressed && !inactive && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon}
          <Text style={[styles.pillText, { color }, disabled && styles.pillTextOff]}>{title}</Text>
          {badge}
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  secure,
  style,
  ...input
}: TextInputProps & { label?: string; secure?: boolean }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={theme.placeholder}
          secureTextEntry={secure && hidden}
          style={[styles.input, style]}
          {...input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? 'common.showPassword' : 'common.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
          >
            <Icon icon={hidden ? ViewOffSlashIcon : ViewIcon} size={20} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A section with nothing to show yet: icon, short title, one line of text, in a white
 * rounded box. Used where the backend isn't built yet or there's simply no data.
 */
export function EmptySection({ icon, title, text }: { icon: AppIcon; title: string; text: string }) {
  return (
    <View style={styles.emptySection}>
      <View style={styles.emptyIcon}>
        <Icon icon={icon} size={22} color={theme.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Avatar({ name, url, size = 80 }: { name: string | null; url: string | null; size?: number }) {
  const { t } = useI18n();
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const box = { width: size, height: size, borderRadius: size / 2 };
  return url ? (
    <Image source={{ uri: url }} style={[box, styles.avatarRing]} contentFit="cover" accessibilityLabel={name ?? t('common.profilePicture')} />
  ) : (
    <View style={[box, styles.avatarRing, styles.avatarFallback]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.gutter,
    paddingTop: 8,
    paddingBottom: 20,
  },
  // 44 pt: Apple's minimum comfortable tap size.
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 44, height: 44 },
  pageTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: theme.text },
  group: { ...squircle, backgroundColor: theme.surface, borderRadius: theme.radius, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: theme.muted, marginTop: 24, marginBottom: 10, marginLeft: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitleInRow: { marginTop: 0, marginBottom: 0 },
  sectionAction: { fontSize: 15, fontWeight: '600', color: theme.link },
  row: { minHeight: theme.rowHeight, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPressed: { opacity: 0.6 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 17, color: theme.text },
  rowValue: { fontSize: 17, color: theme.muted, maxWidth: '55%' },
  disabledText: { color: theme.muted },
  soon: { ...squircle, backgroundColor: theme.fill, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontSize: 12, fontWeight: '600', color: theme.muted },
  primary: {
    ...squircle,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: theme.onPrimary, fontSize: 17, fontWeight: '600' },
  inactive: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  pill: {
    ...squircle,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  pillText: { fontSize: 17, fontWeight: '500' },
  pillTextOff: { opacity: 0.4 },
  fieldWrap: { gap: 8 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
  inputRow: {
    ...squircle,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  input: { flex: 1, height: '100%', fontSize: 17, color: theme.text },
  emptySection: {
    ...squircle,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.text, textAlign: 'center' },
  emptyText: { fontSize: 14, color: theme.muted, textAlign: 'center', lineHeight: 20 },
  error: { ...squircle, backgroundColor: theme.dangerSoft, borderRadius: 20, padding: 12 },
  errorText: { color: theme.danger, fontSize: 15, textAlign: 'center' },
  // Same as the shop logo: a 4 pt ring in the page colour.
  avatarRing: { borderWidth: 4, borderColor: theme.background },
  avatarFallback: { backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
});
