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
import { theme } from '../lib/theme';


/** Pushed page: round back button + centred title (Profile details, Settings, About…). */
export function PageHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.pageHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/you')))}
        style={styles.backButton}
        hitSlop={8}
      >
        <Icon icon={ArrowLeft01Icon} size={24} color={theme.text} />
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
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
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

export function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
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
      {onPress && !right ? <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} /> : null}
    </Pressable>
  );
}

/** Small grey "Soon" tag for features whose backend isn't ready yet. */
export function SoonTag() {
  return (
    <View style={styles.soon}>
      <Text style={styles.soonText}>Soon</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.primary, inactive && styles.inactive, pressed && !inactive && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

/** White pill button, e.g. "Logout" in red on Settings. */
export function PillButton({
  title,
  onPress,
  color = theme.text,
  icon,
  loading,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon}
          <Text style={[styles.pillText, { color }]}>{title}</Text>
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
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
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

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Avatar({ name, url, size = 80 }: { name: string | null; url: string | null; size?: number }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const box = { width: size, height: size, borderRadius: size / 2 };
  return url ? (
    <Image source={{ uri: url }} style={[box, styles.avatarBorder]} contentFit="cover" accessibilityLabel={name ?? 'Profile picture'} />
  ) : (
    <View style={[box, styles.avatarFallback]}>
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
  group: { backgroundColor: theme.surface, borderRadius: theme.radius, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: theme.muted, marginTop: 24, marginBottom: 10, marginLeft: 2 },
  row: { minHeight: theme.rowHeight, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPressed: { opacity: 0.6 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 17, color: theme.text },
  rowValue: { fontSize: 17, color: theme.muted, maxWidth: '55%' },
  disabledText: { color: theme.muted },
  soon: { backgroundColor: theme.fill, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontSize: 12, fontWeight: '600', color: theme.muted },
  primary: {
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
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  pillText: { fontSize: 17, fontWeight: '500' },
  fieldWrap: { gap: 8 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
  inputRow: {
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  input: { flex: 1, height: '100%', fontSize: 17, color: theme.text },
  error: { backgroundColor: theme.dangerSoft, borderRadius: 14, padding: 12 },
  errorText: { color: theme.danger, fontSize: 15, textAlign: 'center' },
  avatarBorder: { borderWidth: 3, borderColor: theme.surface },
  avatarFallback: { backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
});
