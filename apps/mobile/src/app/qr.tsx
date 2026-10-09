import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import WifiDisconnected01Icon from '@hugeicons/core-free-icons/WifiDisconnected01Icon';
import { Icon } from '../components/Icon';
import { router, useLocalSearchParams } from 'expo-router';
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
import { Avatar, ErrorBox, PillButton, PrimaryButton, Screen } from '../components/ui';
import { api, ApiError, type NewQrCode, type QrCollectResult } from '../lib/api';
import { t, useI18n } from '../i18n';
import { useSession } from '../lib/session';
import { squircle, theme } from '../lib/theme';

const POLL_MS = 2000;
const QR_LIFETIME_MS = 5 * 60 * 1000;

type Phase =
  | { kind: 'loading' }
  | { kind: 'showing'; qr: NewQrCode; deadline: number }
  | { kind: 'done'; result: QrCollectResult | null }
  | { kind: 'ended'; reason: 'expired' | 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * Collect QR (tab bar QR button, or Collect on a shop page). Gets a one-time code from the
 * API, shows it, and checks every 2 s whether the staff used it; then shows "+N points" and
 * the new balance. From the tab bar it is the master QR: it names no shop, and the staff
 * member who scans it decides the shop and branch. From a shop page (`vendorId` + `vendorName`)
 * it is that shop's QR: any other shop's staff get vendor_mismatch and give no points; the
 * help text names that shop.
 *
 * Laid out like a ticket ("Dvote ID"): the customer's photo and name, a perforated tear line,
 * then their code, in the middle of the page. When the code expires (or the clock runs out on
 * the phone first), was replaced, or couldn't be made, the code gives way to a "Regenerate my
 * QR code" button.
 */
export default function Qr() {
  const { vendorId, vendorName } = useLocalSearchParams<{ vendorId?: string; vendorName?: string }>();
  const { handleAuthError } = useSession();
  useI18n(); // re-render on a language switch (children read t directly)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [offline, setOffline] = useState(false);
  // id of the QR on screen while it can still be used: cancelled if the customer leaves
  const activeId = useRef<string | null>(null);

  const issue = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setOffline(false);
    try {
      const qr = await api.newCollectQr(vendorId);
      // Count down from the server's expiry, unless the phone's clock is clearly off.
      const left = new Date(qr.expiresAt).getTime() - Date.now();
      const deadline = Date.now() + (left > 0 && left <= QR_LIFETIME_MS + 30_000 ? left : QR_LIFETIME_MS);
      activeId.current = qr.id;
      setPhase({ kind: 'showing', qr, deadline });
    } catch (err) {
      if (await handleAuthError(err)) return;
      setPhase({ kind: 'error', message: err instanceof ApiError ? err.message : t('qr.couldNotCreate') });
    }
  }, [handleAuthError, vendorId]);

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
        <Text style={styles.title} numberOfLines={1}>
          {phase.kind === 'done' ? t('qr.pointsAdded') : t('qr.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Icon icon={Cancel01Icon} size={22} color={theme.text} />
        </Pressable>
      </View>

      {phase.kind === 'done' ? (
        <Done result={phase.result} />
      ) : (
        <IdCard
          phase={phase}
          offline={offline}
          vendorName={vendorName}
          onExpired={() => {
            // the phone's countdown ran out before the next poll heard it from the server
            activeId.current = null;
            setPhase({ kind: 'ended', reason: 'expired' });
          }}
          onRegenerate={() => void issue()}
        />
      )}
    </Screen>
  );
}

/** The customer's photo and name above their code (or what to do when there's no code). */
function IdCard({
  phase,
  offline,
  vendorName,
  onExpired,
  onRegenerate,
}: {
  phase: Exclude<Phase, { kind: 'done' }>;
  offline: boolean;
  vendorName?: string;
  onExpired: () => void;
  onRegenerate: () => void;
}) {
  const { me } = useSession();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - theme.gutter * 2, 380);
  const qrSize = cardWidth - CARD_PADDING * 2 - 24;

  return (
    <View style={styles.page}>
      <View style={[styles.card, { width: cardWidth }]}>
        <View style={styles.person}>
          <Avatar name={me?.name ?? null} url={me?.avatarUrl ?? null} size={72} />
          <Text style={styles.name} numberOfLines={1}>
            {me?.name ?? t('you.member')}
          </Text>
        </View>

        <TearLine width={cardWidth} />

        {phase.kind === 'loading' ? (
          <View style={[styles.qrArea, { height: qrSize }]}>
            <ActivityIndicator color={theme.text} />
          </View>
        ) : phase.kind === 'showing' ? (
          <Showing qr={phase.qr} deadline={phase.deadline} offline={offline} size={qrSize} onExpired={onExpired} />
        ) : (
          <Regenerate
            minHeight={qrSize}
            heading={
              phase.kind === 'error'
                ? t('qr.errorTitle')
                : phase.reason === 'expired'
                  ? t('qr.expiredTitle')
                  : t('qr.replacedTitle')
            }
            text={phase.kind === 'error' ? null : phase.reason === 'expired' ? t('qr.expiredText') : t('qr.replacedText')}
            error={phase.kind === 'error' ? phase.message : null}
            onPress={onRegenerate}
          />
        )}
      </View>

      {phase.kind === 'showing' || phase.kind === 'loading' ? (
        <Text style={styles.help}>{vendorName ? t('qr.atVendor', { vendor: vendorName }) : t('qr.worksAnywhere')}</Text>
      ) : null}
    </View>
  );
}

function Showing({
  qr,
  deadline,
  offline,
  size,
  onExpired,
}: {
  qr: NewQrCode;
  deadline: number;
  offline: boolean;
  size: number;
  onExpired: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;
  useEffect(() => {
    if (secondsLeft === 0) expiredRef.current();
  }, [secondsLeft]);

  return (
    <View style={styles.qrBlock}>
      <View style={[styles.qrArea, { height: size }]}>
        <QRCode value={qr.code} size={size} color="#000" backgroundColor="#fff" ecl="M" />
      </View>
      <Text style={styles.expires}>{t('qr.expiresIn', { time: countdown })}</Text>
      <View style={styles.waiting}>
        {offline ? (
          <>
            <Icon icon={WifiDisconnected01Icon} size={16} color={theme.muted} />
            <Text style={styles.waitingText}>{t('qr.reconnecting')}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={theme.muted} />
            <Text style={styles.waitingText}>{t('qr.waiting')}</Text>
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
            <Text style={styles.points}>{t('common.plusPoints', { count: result.pointsAdded })}</Text>
            <Text style={styles.text}>
              {t('qr.at', { place: result.branchName ? `${result.vendorName} · ${result.branchName}` : result.vendorName })}
            </Text>
            <View style={styles.summary}>
              <SummaryRow label={t('qr.bill')} value={`${result.purchaseAmount} ${result.currency}`} />
              <View style={styles.separator} />
              <SummaryRow label={t('qr.balance')} value={t('common.points', { count: result.cardBalance })} strong />
            </View>
          </>
        ) : (
          <Text style={styles.points}>{t('qr.pointsAdded')}</Text>
        )}
      </View>
      <View style={styles.footer}>
        {result ? (
          <PrimaryButton title={t('qr.viewCard')} onPress={() => router.replace(`/card/${result.cardId}`)} />
        ) : null}
        <PillButton title={t('common.done')} onPress={() => router.back()} />
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

/** The ticket's perforation: a dashed line with a half-circle notch cut into each side. */
function TearLine({ width }: { width: number }) {
  // the dashes stop a little short of the notches
  const inner = width - CARD_PADDING * 2 - (NOTCH - 8);
  const dashes = Math.floor((inner + DASH_GAP) / (DASH + DASH_GAP));
  return (
    <View style={styles.tear}>
      <View style={[styles.notch, { left: -CARD_PADDING - NOTCH / 2 }]} />
      <View style={styles.dashes}>
        {Array.from({ length: dashes }, (_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </View>
      <View style={[styles.notch, { right: -CARD_PADDING - NOTCH / 2 }]} />
    </View>
  );
}

/** In place of the code: why there isn't one, and a button for a new one. */
function Regenerate({
  minHeight,
  heading,
  text,
  error,
  onPress,
}: {
  minHeight: number;
  heading: string;
  text: string | null;
  error: string | null;
  onPress: () => void;
}) {
  return (
    <View style={[styles.regenerate, { minHeight }]}>
      <View style={styles.icon}>
        <Icon icon={QrCodeIcon} size={36} color={theme.text} />
      </View>
      <Text style={styles.lead}>{heading}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      <ErrorBox message={error} />
      <PrimaryButton title={t('qr.regenerate')} onPress={onPress} style={styles.regenerateButton} />
    </View>
  );
}

const CARD_PADDING = 20;
const NOTCH = 28;
const DASH = 8;
const DASH_GAP = 6;

const styles = StyleSheet.create({
  // Title centred; room above it and on both sides so it never runs under the close button.
  header: {
    justifyContent: 'center',
    minHeight: 40,
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: theme.gutter,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center', marginHorizontal: 56 },
  close: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // the card sits in the middle of the page
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.gutter, paddingBottom: 24 },
  card: {
    ...squircle,
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: CARD_PADDING,
    alignItems: 'center',
  },
  person: { alignItems: 'center', gap: 10, paddingTop: 4 },
  name: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
  tear: { alignSelf: 'stretch', height: NOTCH, justifyContent: 'center', marginVertical: 8 },
  // page-coloured circles over the card's edges look like bites taken out of it
  notch: { position: 'absolute', top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: theme.background },
  dashes: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: NOTCH / 2 - 4 },
  dash: { width: DASH, height: 2, borderRadius: 1, backgroundColor: theme.separator },
  qrBlock: { alignItems: 'center', gap: 12 },
  qrArea: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  expires: { fontSize: 15, fontWeight: '600', color: theme.muted, fontVariant: ['tabular-nums'] },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waitingText: { fontSize: 14, color: theme.muted },
  help: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21, marginTop: 20, paddingHorizontal: 8 },
  regenerate: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 8 },
  regenerateButton: { alignSelf: 'stretch', marginTop: 12 },
  // Done
  body: { flex: 1, paddingHorizontal: theme.gutter, paddingTop: 12 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  lead: { fontSize: 20, fontWeight: '700', color: theme.text, textAlign: 'center', marginTop: 8 },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21 },
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: 12, paddingBottom: 16 },
});
