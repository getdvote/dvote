import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configProblem } from '../lib/config';
import { SessionProvider } from '../lib/session';
import { theme } from '../lib/theme';

// Closes the in-app browser after Google / Facebook sign-in returns to the app.
WebBrowser.maybeCompleteAuthSession();

// Always start at index (it redirects to Welcome or Cards), never at a modal like /qr.
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  // Inter, the app font (see lib/theme). Bundled with the app, so this is quick and offline.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  // Keep the splash screen until the font is ready, so text never flashes in another font.
  // If loading fails, carry on with the system font rather than a blank app.
  if (!fontsLoaded && !fontError) return null;

  if (configProblem) return <SetupNeeded message={configProblem} />;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          {/* index first: explicitly listed screens come first in the stack */}
          <Stack.Screen name="index" />
          <Stack.Screen name="qr" options={{ presentation: 'modal' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/** Shown during development when apps/mobile/.env is incomplete. */
function SetupNeeded({ message }: { message: string }) {
  return (
    <View style={styles.setup}>
      <Text style={styles.setupTitle}>Setup needed</Text>
      <Text style={styles.setupText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  setup: { flex: 1, justifyContent: 'center', padding: 28, gap: 14, backgroundColor: theme.background },
  setupTitle: { fontSize: 24, fontWeight: '700', color: theme.text },
  setupText: { fontSize: 15, color: theme.secondary, lineHeight: 22 },
});
