import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import WifiDisconnected01Icon from '@hugeicons/core-free-icons/WifiDisconnected01Icon';
import { Icon } from '../components/Icon';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text } from '../components/Text';
import { ErrorBox, PillButton, PrimaryButton, Screen } from '../components/ui';
import { api, ApiError, type NewQrCode, type QrCollectResult } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

const POLL_MS = 2000;
const QR_LIFETIME_MS = 5 * 60 * 1000;

type Phase =
  | { kind: 'loading' }
  | { kind: 'showing'; qr: NewQrCode; deadline: number }
  | { kind: 'done'; result: QrCollectResult | null }
  | { kind: 'ended'; reason: 'expired' | 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * Collect QR (tab bar QR button). Gets a one-time code from the API, shows it, and checks
 * every 2 s whether the staff used it; then shows "+N points" and the new balance.
 * The code names no shop: the staff member who scans it decides the shop and branch.
 */
export default function Qr() {
  const { handleAuthError } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [offline, setOffline] = useState(false);
  // id of the QR on screen while it can still be used: cancelled if the customer leaves
  const activeId = useRef<string | null>(null);

  const issue = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setOffline(false);
    try {
      const qr = await api.newCollectQr();
      // Count down from the server's expiry, unless the phone's clock is clearly off.
      const left = new Date(qr.expiresAt).getTime() - Date.now();
      const deadline = Date.now() + (left > 0 && left <= QR_LIFETIME_MS + 30_000 ? left : QR_LIFETIME_MS);
      activeId.current = qr.id;
      setPhase({ kind: 'showing', qr, deadline });
    } catch (err) {
      if (await handleAuthError(err)) return;
      setPhase({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not create your QR code.' });
    }
  }, [handleAuthError]);

  useEffect(() => {
    void issue();
  }, [issue]);

  // Leaving the screen cancels a QR that wasn't used, so a photo of it is worthless.
  useEffect(
    () => () => {
      if (activeId.current) void api.cancelQr(activeId.current).catch(() => undefined);
    },
    [],
  );

  // Poll while the QR is on screen.
  const qrId = phase.kind === 'showing' ? phase.qr.id : null;
  useEffect(() => {
    if (!qrId) return;
    let stopped = false;
    let busy = false;
    const check = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const s = await api.qrStatus(qrId);
        if (stopped) return;
        setOffline(false);
        if (s.status === 'used') {
          activeId.current = null;
          Vibration.vibrate(80);
          setPhase({ kind: 'done', result: s.result });
        } else if (s.status === 'expired' || s.status === 'cancelled') {
          activeId.current = null;
          setPhase({ kind: 'ended', reason: s.status });
        }
      } catch (err) {
        if (stopped) return;
        if (await handleAuthError(err)) return;
        setOffline(true); // keep trying: the next poll may get through
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [qrId, handleAuthError]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{phase.kind === 'done' ? 'Points added' : 'Collect points'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={8}
        >
          <Icon icon={Cancel01Icon} size={22} color={theme.text} />
        </Pressable>
      </View>

      {phase.kind === 'loading' ? (
        <View style={styles.middle}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : phase.kind === 'showing' ? (
        <Showing qr={phase.qr} deadline={phase.deadline} offline={offline} />
      ) : phase.kind === 'done' ? (
        <Done result={phase.result} />
      ) : (
        <Ended
          heading={phase.kind === 'error' ? 'Something went wrong' : phase.reason === 'expired' ? 'QR code expired' : 'QR code replaced'}
          text={
            phase.kind === 'error'
              ? null
              : phase.reason === 'expired'
                ? 'For your safety each code works for 5 minutes only. Get a new one when you are at the counter.'
                : 'A newer QR code was opened, so this one stopped working.'
          }
          error={phase.kind === 'error' ? phase.message : null}
          onRetry={() => void issue()}
        />
      )}
    </Screen>
  );
}

function Showing({ qr, deadline, offline }: { qr: NewQrCode; deadline: number; offline: boolean }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - theme.gutter * 2 - 56, 280);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <View style={styles.body}>
      <View style={styles.qrCard}>
        <QRCode value={qr.code} size={size} color="#000" backgroundColor="#fff" ecl="M" />
        <Text style={styles.expires}>
          {secondsLeft > 0 ? `Expires in ${countdown}` : 'Expired'}
        </Text>
      </View>

      <Text style={styles.lead}>Show this code at the counter</Text>
      <Text style={styles.text}>
        Works at any dvote coffee shop: the staff scan it and enter your bill, and your points appear here
        straight away.
      </Text>

      <View style={styles.waiting}>
        {offline ? (
          <>
            <Icon icon={WifiDisconnected01Icon} size={16} color={theme.muted} />
            <Text style={styles.waitingText}>Reconnecting…</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={theme.muted} />
            <Text style={styles.waitingText}>Waiting for the scan…</Text>
          </>
        )}
      </View>
    </View>
  );
}

function Done({ result }: { result: QrCollectResult | null }) {
  const pop = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [pop]);

  return (
    <View style={styles.body}>
      <View style={styles.middle}>
        <Animated.View style={[styles.check, { transform: [{ scale: pop }] }]}>
          <Icon icon={Tick02Icon} size={48} color="#fff" strokeWidth={2.5} />
        </Animated.View>
        {result ? (
          <>
            <Text style={styles.points}>+{result.pointsAdded} points</Text>
            <Text style={styles.text}>
              at {result.vendorName}
              {result.branchName ? ` · ${result.branchName}` : ''}
            </Text>
            <View style={styles.summary}>
              <SummaryRow label="Bill" value={`${result.purchaseAmount} ${result.currency}`} />
              <View style={styles.separator} />
              <SummaryRow label="Your balance" value={`${result.cardBalance} points`} strong />
            </View>
          </>
        ) : (
          <Text style={styles.points}>Points added</Text>
        )}
      </View>
      <View style={styles.footer}>
        {result ? (
          <PrimaryButton title="View card" onPress={() => router.replace(`/card/${result.cardId}`)} />
        ) : null}
        <PillButton title="Done" onPress={() => router.back()} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

function Ended({
  heading,
  text,
  error,
  onRetry,
}: {
  heading: string;
  text: string | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.body}>
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Icon icon={QrCodeIcon} size={40} color={theme.text} />
        </View>
        <Text style={styles.lead}>{heading}</Text>
        {text ? <Text style={styles.text}>{text}</Text> : null}
        <ErrorBox message={error} />
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Get a new QR code" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '600', color: theme.text },
  close: {
    position: 'absolute',
    right: theme.gutter,
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: theme.gutter, paddingTop: 12 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  qrCard: {
    alignSelf: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 28,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 14,
  },
  expires: { fontSize: 15, fontWeight: '600', color: theme.muted, fontVariant: ['tabular-nums'] },
  lead: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center', marginTop: 24 },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21, marginTop: 6 },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  waitingText: { fontSize: 15, color: theme.muted },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  points: { fontSize: 34, fontWeight: '800', color: theme.text },
  summary: {
    alignSelf: 'stretch',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  summaryRow: { minHeight: theme.rowHeight, flexDirection: 'row', alignItems: 'center' },
  summaryLabel: { flex: 1, fontSize: 17, color: theme.secondary },
  summaryValue: { fontSize: 17, color: theme.text },
  summaryStrong: { fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: 12, paddingBottom: 16 },
});
