import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import ArrowDataTransferVerticalIcon from '@hugeicons/core-free-icons/ArrowDataTransferVerticalIcon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { StyleSheet, View } from 'react-native';
import { getLanguage, isRtl, localized, t, useI18n } from '../i18n';
import type { CardEvent } from '../lib/api';
import { showDate, showTime } from '../lib/dates';
import { squircle, theme } from '../lib/theme';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Text } from './Text';

/** "10.00" → "10", "12.50" → "12.50" */
const amount = (v: string) => v.replace(/\.00$/, '');

/** What happened: "Points earned", the redeemed reward's name, or "Correction by dvote". */
export const eventTitle = (e: CardEvent) =>
  e.type === 'earn'
    ? t('card.earned')
    : e.type === 'redeem'
      ? (localized(e.rewardName, e.rewardNameAr) ?? t('card.redeemed'))
      : t('card.correction');

export const eventIcon = (e: CardEvent) =>
  e.type === 'earn' ? Add01Icon : e.type === 'redeem' ? GiftIcon : ArrowDataTransferVerticalIcon;

/** Green for points in, orange for points out. */
export const eventColors = (e: CardEvent) =>
  e.delta > 0 ? { fg: theme.success, bg: '#E6F7EC' } : { fg: '#E8820C', bg: '#FFF1E6' };

/**
 * One history entry (tap a row in Card details → History): the points, what happened, and
 * when, the bill and the branch. Rows the event doesn't have (no bill on a redeem, no branch
 * on a correction) are left out.
 */
export function EventSheet({
  event,
  currency,
  visible,
  onClose,
  onClosed,
}: {
  event: CardEvent | null;
  currency: string;
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
}) {
  const { t } = useI18n();
  const colors = event ? eventColors(event) : null;
  const when = event ? new Date(event.createdAt) : null;
  const details = event
    ? [
        { label: t('card.when'), value: `${showDate(when!)} · ${showTime(when!)}` },
        event.purchaseAmount
          ? { label: t('card.billAmount'), value: `${amount(event.purchaseAmount)} ${currency}` }
          : null,
        event.branchName ? { label: t('card.branch'), value: event.branchName } : null,
      ].filter((d): d is { label: string; value: string } => d !== null)
    : [];

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} title={t('card.details')}>
      {event && colors ? (
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={[styles.icon, { backgroundColor: colors.bg }]}>
              <Icon icon={eventIcon(event)} size={28} color={colors.fg} />
            </View>
            <Text style={[styles.delta, { color: event.delta > 0 ? theme.success : theme.text }]}>
              {event.delta > 0 ? '+' : '−'}
              {t('common.points', { count: Math.abs(event.delta) })}
            </Text>
            <Text style={styles.title}>{eventTitle(event)}</Text>
          </View>

          <View style={styles.box}>
            {details.map((d, i) => (
              <View key={d.label} style={[styles.row, i < details.length - 1 && styles.rowBorder]}>
                <Text style={styles.label}>{d.label}</Text>
                {/* the value sits at the row's end: right in English, left in Arabic */}
                <Text style={[styles.value, { textAlign: isRtl(getLanguage()) ? 'left' : 'right' }]}>{d.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: theme.gutter, gap: 20 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 4 },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  delta: { fontSize: 28, fontWeight: '700' },
  title: { fontSize: 16, color: theme.muted, textAlign: 'center' },
  // The sheet is white, so the details sit on the light page grey.
  box: { ...squircle, backgroundColor: theme.background, borderRadius: theme.radius, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  label: { fontSize: 15, color: theme.muted },
  value: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: theme.text },
});
