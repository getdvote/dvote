import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

/** Full-screen page: grey background, phone-width column centred on big screens. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.column}>{children}</View>
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
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={theme.placeholder}
          secureTextEntry={secure && hidden}
          style={styles.input}
          {...input}
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
}: {
  vendorName: string;
  logoUrl: string | null;
  branchName?: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.welcome}>Welcome,</Text>
        <Text style={styles.welcome}>{vendorName}</Text>
        {branchName ? <Text style={styles.branch}>{branchName}</Text> : null}
      </View>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
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
  column: {
    flex: 1,
    width: '100%',
    maxWidth: theme.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: theme.gutter,
  },
  button: {
    height: theme.buttonHeight,
    borderRadius: theme.radius,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: theme.onPrimary, fontSize: 17, fontWeight: '500' },
  link: { color: theme.text, fontSize: 17, textAlign: 'center' },
  fieldWrap: { gap: 8 },
  label: { fontSize: 16, fontWeight: '600', color: theme.text },
  inputRow: {
    height: theme.controlHeight,
    borderRadius: theme.radius,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  // outlineWidth 0: no browser focus ring on the web (the rounded field is the design)
  input: { flex: 1, height: '100%', fontSize: 17, color: theme.text, outlineWidth: 0 },
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
  headerText: { flex: 1, paddingTop: 8 },
  welcome: { fontSize: 17, fontWeight: '500', color: theme.text, lineHeight: 28 },
  branch: { fontSize: 15, color: theme.muted, marginTop: 2 },
  logo: { width: 96, height: 96 },
  logoFallback: {
    borderRadius: 48,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: { fontSize: 36, fontWeight: '700', color: theme.text },
});
