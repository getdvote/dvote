import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

/** Explicit font faces keep Inter's weights consistent on native and web. */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style);
  const weight = String(flat?.fontWeight ?? '400');
  const fontFamily =
    flat?.fontFamily ??
    (['700', '800', '900', 'bold'].includes(weight)
      ? theme.font.bold
      : weight === '600'
        ? theme.font.semibold
        : weight === '500'
          ? theme.font.medium
          : theme.font.regular);
  return (
    <NativeText {...props} style={[{ color: theme.text }, style, { fontFamily, fontWeight: 'normal' }]} />
  );
}

/** Dashboard-style dark brand bar, white page and stone canvas, sized for staff tasks. */
export function Screen({
  children,
  backgroundLogoUrl,
}: {
  children: ReactNode;
  backgroundLogoUrl?: string | null;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.column}>
        {backgroundLogoUrl ? (
          <View
            style={styles.backdrop}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              source={{ uri: backgroundLogoUrl }}
              style={styles.watermark}
              resizeMode="cover"
              accessible={false}
            />
          </View>
        ) : null}
        <View style={styles.toolbar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Image
                source={require('../../assets/dvote-logo.png')}
                style={styles.wordmark}
                resizeMode="contain"
                accessible={false}
              />
            </View>
            <Text style={styles.brandName}>dvote</Text>
          </View>
          <Text style={styles.staffBadge}>Staff</Text>
        </View>
        <View style={styles.page}>{children}</View>
      </View>
    </SafeAreaView>
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
      style={({ pressed }) => [
        styles.button,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  suffix,
  secure,
  ...input
}: TextInputProps & { label?: string; suffix?: string; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, focused && styles.inputFocused]}>
        <TextInput
          placeholderTextColor={theme.placeholder}
          secureTextEntry={secure && hidden}
          style={styles.input}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
          >
            <Text style={styles.eye}>{hidden ? 'Show' : 'Hide'}</Text>
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

/** "Welcome, <vendor>" + branch on the left, vendor logo on the right (designs 2–4). */
export function VendorHeader({
  vendorName,
  logoUrl,
  branchName,
  prominent = false,
}: {
  vendorName: string;
  logoUrl: string | null;
  branchName?: string | null;
  prominent?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[styles.welcome, prominent && styles.welcomeLarge]}>Welcome,</Text>
        <Text style={[styles.welcome, prominent && styles.vendorLarge]}>{vendorName}</Text>
        {branchName ? (
          <Text style={[styles.branch, prominent && styles.branchLarge]}>{branchName}</Text>
        ) : null}
      </View>
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={styles.logo}
          resizeMode="cover"
          accessibilityLabel={`${vendorName} logo`}
        />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Text style={styles.logoInitial}>{vendorName.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

export function showHelp() {
  const message =
    'For login problems or a QR that does not scan, ask your shop manager. They can reset your account from the dvote dashboard.';
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Need help?', message);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermark: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: 105,
    right: -60,
    opacity: 0.025,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: theme.maxWidth,
    minWidth: 0,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: theme.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.border,
  },
  toolbar: {
    minHeight: 60,
    backgroundColor: theme.sidebar,
    paddingHorizontal: theme.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { width: 26, height: 26 },
  brandName: { color: theme.onPrimary, fontSize: 21, fontWeight: '700', letterSpacing: -0.5 },
  staffBadge: {
    color: theme.onPrimary,
    fontSize: 12,
    backgroundColor: '#2C2926',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  page: { flex: 1, width: '100%', minWidth: 0, paddingHorizontal: theme.gutter },
  button: {
    height: theme.buttonHeight,
    borderRadius: theme.radius,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: theme.onPrimary, fontSize: 15, fontWeight: '600' },
  link: { color: theme.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  fieldWrap: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: theme.text },
  inputRow: {
    height: theme.controlHeight,
    borderRadius: theme.radius,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  // outlineWidth 0: no browser focus ring on the web (the rounded field is the design)
  input: { flex: 1, height: '100%', fontFamily: theme.font.regular, fontSize: 15, color: theme.text },
  inputFocused: { borderColor: theme.primary },
  suffix: { fontSize: 15, color: theme.placeholder },
  eye: { fontSize: 15, color: theme.muted },
  error: { backgroundColor: theme.dangerSoft, borderRadius: 14, padding: 12 },
  errorText: { color: theme.danger, fontSize: 15, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 24,
  },
  headerText: { flex: 1, minWidth: 0, paddingTop: 8 },
  welcome: { fontSize: 17, fontWeight: '500', color: theme.text, lineHeight: 28 },
  welcomeLarge: { fontSize: 18, lineHeight: 28, color: theme.muted },
  vendorLarge: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1, marginTop: 4 },
  branchLarge: { fontSize: 14, color: theme.muted, marginTop: 10 },
  branch: { fontSize: 14, color: theme.muted, marginTop: 2 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginLeft: 16,
    flexShrink: 0,
    backgroundColor: theme.subtle,
  },
  logoFallback: {
    borderRadius: 48,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: { fontSize: 36, fontWeight: '700', color: theme.text },
});
