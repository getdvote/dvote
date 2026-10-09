import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ErrorBox, Field, PrimaryButton, Screen, TextLink } from '../components/ui';
import { api, ApiError, friendlyMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

const QR_PREFIX = 'dvote:q1:';

/**
 * Scan the customer's QR (camera on phones and in the browser). The server checks it: a collect
 * QR goes on to the bill amount, a redeem QR to the reward confirmation.
 * (preview) before we ask for the bill amount. "Type the code" is a fallback for a
 * camera that can't focus, and for testing on a computer.
 */
export default function Scan() {
  const { me, handleAuthError, setScannedCode } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState('');
  const busy = useRef(false); // the camera reports the same QR many times per second
  const { width } = useWindowDimensions();
  // Square camera: the column width (phone-width, minus side gutters). Computed, because
  // a percentage width + aspectRatio is measured wrongly on the web.
  const box = { width: Math.min(width, theme.maxWidth) - theme.gutter * 2 };
  const square = { ...box, height: box.width };

  const check = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (busy.current) return;
      busy.current = true;
      setError(null);
      if (!code.startsWith(QR_PREFIX)) {
        setError('This is not a dvote QR code.');
        setTimeout(() => (busy.current = false), 1500);
        return;
      }
      setChecking(true);
      try {
        const preview = await api.preview(code);
        if (!preview.usable) throw new ApiError(409, preview.reason ?? 'wrong_qr_type', '');
        setScannedCode(code);
        if (preview.purpose === 'redeem' && preview.redeem) {
          // A reward: confirm who gets what, no bill to type.
          router.replace({ pathname: '/redeem', params: { preview: JSON.stringify(preview.redeem) } });
        } else {
          router.replace('/amount');
        }
      } catch (err) {
        if (await handleAuthError(err)) return;
        setError(
          err instanceof ApiError
            ? err.message || friendlyMessage(err.code)
            : 'Could not check this QR. Please try again.',
        );
        setTimeout(() => (busy.current = false), 1500);
      } finally {
        setChecking(false);
      }
    },
    [handleAuthError, setScannedCode],
  );

  if (!me) return <Redirect href="/login" />;

  const onScanned = (result: BarcodeScanningResult) => void check(result.data);

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.title}>Scan the customer's QR</Text>
        <Text style={styles.hint}>Ask the customer to show their QR in the dvote app: to collect points, or for a reward.</Text>
      </View>

      {manual ? (
        <View style={styles.manual}>
          <Field
            label="QR code text"
            placeholder="dvote:q1:..."
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => void check(typed)}
          />
          <PrimaryButton
            title="Continue"
            loading={checking}
            onPress={() => {
              busy.current = false;
              void check(typed);
            }}
          />
        </View>
      ) : !permission ? (
        <ActivityIndicator color={theme.text} style={[styles.cameraBox, square]} />
      ) : !permission.granted ? (
        <View style={[styles.cameraBox, square, styles.center, styles.permission]}>
          <Text style={styles.hint}>The camera is needed to scan QR codes.</Text>
          <PrimaryButton title="Allow camera" onPress={() => void requestPermission()} />
        </View>
      ) : (
        <View style={[styles.cameraBox, square]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={checking ? undefined : onScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
          {checking ? (
            <View style={[StyleSheet.absoluteFill, styles.center, styles.dim]}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          ) : null}
        </View>
      )}

      <ErrorBox message={error} />

      <View style={styles.footer}>
        <TextLink
          title={manual ? 'Use the camera' : 'Type the code instead'}
          onPress={() => {
            setManual((m) => !m);
            setError(null);
            busy.current = false;
          }}
        />
        <TextLink title="Cancel" onPress={() => router.replace('/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: 32, gap: 6, marginBottom: 20 },
  title: { fontSize: 21, fontWeight: '700', color: theme.text, textAlign: 'center' },
  hint: { fontSize: 15, color: theme.muted, textAlign: 'center' },
  cameraBox: {
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16,
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  permission: { backgroundColor: theme.surface, alignItems: 'stretch' },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  frame: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    right: '18%',
    bottom: '18%',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 20,
  },
  manual: { gap: 16, marginBottom: 16 },
  footer: { marginTop: 'auto', paddingBottom: 24, gap: 18 },
});
