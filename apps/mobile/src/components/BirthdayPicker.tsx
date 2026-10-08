import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowUp01Icon from '@hugeicons/core-free-icons/ArrowUp01Icon';
import { Icon, type AppIcon } from './Icon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OLDEST_BIRTHDAY, todayYmd } from '../lib/dates';
import { theme } from '../lib/theme';
import { Text } from './Text';
import { PrimaryButton } from './ui';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FIRST_YEAR = Number(OLDEST_BIRTHDAY.slice(0, 4));
const YEAR_ROW = 52;

type Mode = 'days' | 'months' | 'years';
interface Ymd { y: number; m: number; d: number } // m: 0-11

const parse = (s: string): Ymd => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};
const format = ({ y, m, d }: Ymd) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/**
 * Bottom-sheet calendar for birthdays, drawn in the app's own style (same on Android, iPhone
 * and web). Year grid → month grid → days; nothing after today or before 1900 can be picked.
 * Changes only apply on "Done".
 */
export function BirthdayPicker({
  visible,
  value,
  onCancel,
  onDone,
}: {
  visible: boolean;
  value: string | null;
  onCancel: () => void;
  onDone: (value: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = parse(todayYmd());

  const [draft, setDraft] = useState<Ymd | null>(null);
  const [shown, setShown] = useState({ y: 2000, m: 0 }); // month on screen
  const [view, setView] = useState<Mode>('days');
  // The tap that opens the sheet (or switches years → months → days) can also land on whatever
  // appears under the finger/pointer (a 'ghost' click, mostly on web): ignore taps for a moment.
  const quietUntil = useRef(0);
  const ready = () => Date.now() > quietUntil.current;
  const settle = () => {
    quietUntil.current = Date.now() + 350;
  };
  useEffect(settle, [view]);

  // Each time it opens: start from the saved birthday, or ask for the year first.
  useEffect(() => {
    if (!visible) return;
    settle();
    const start = value ? parse(value) : null;
    setDraft(start);
    setShown(start ? { y: start.y, m: start.m } : { y: 2000, m: 0 });
    setView(start ? 'days' : 'years');
  }, [visible, value]);

  const sheetWidth = Math.min(width, 520);
  const cell = Math.min(Math.floor((sheetWidth - 32) / 7), 52);
  const isFuture = (y: number, m: number, d = 1) =>
    y > today.y || (y === today.y && (m > today.m || (m === today.m && d > today.d)));
  const canPrev = shown.y > FIRST_YEAR || shown.m > 0;
  const canNext = !isFuture(shown.m === 11 ? shown.y + 1 : shown.y, (shown.m + 1) % 12);

  function move(step: -1 | 1) {
    const i = shown.y * 12 + shown.m + step;
    setShown({ y: Math.floor(i / 12), m: i % 12 });
  }

  const heading = draft
    ? `${WEEKDAYS[new Date(draft.y, draft.m, draft.d).getDay()]}, ${draft.d} ${MONTHS[draft.m]} ${draft.y}`
    : 'Pick your birthday';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => ready() && onCancel()} accessibilityLabel="Close calendar" />
      <View style={[styles.sheet, { width: sheetWidth, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={styles.caption}>Birthday</Text>
        <Text style={[styles.heading, !draft && styles.headingEmpty]}>{heading}</Text>

        {/* month / year bar */}
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose month and year"
            onPress={() => setView(view === 'days' ? 'years' : 'days')}
            style={styles.monthButton}
            hitSlop={6}
          >
            <Text style={styles.monthText}>
              {view === 'years' ? 'Choose year' : view === 'months' ? `${shown.y}` : `${MONTHS[shown.m]} ${shown.y}`}
            </Text>
            <Icon icon={view === 'days' ? ArrowDown01Icon : ArrowUp01Icon} size={16} color={theme.text} />
          </Pressable>
          {view === 'days' ? (
            <View style={styles.arrows}>
              <Arrow icon={ArrowLeft01Icon} label="Previous month" disabled={!canPrev} onPress={() => move(-1)} />
              <Arrow icon={ArrowRight01Icon} label="Next month" disabled={!canNext} onPress={() => move(1)} />
            </View>
          ) : null}
        </View>

        <View style={{ height: cell * 7 + 8 }}>
          {view === 'years' ? (
            <YearGrid
              selected={shown.y}
              lastYear={today.y}
              onPick={(y) => {
                if (!ready()) return;
                setShown({ y, m: y === today.y ? Math.min(shown.m, today.m) : shown.m });
                setView('months');
              }}
            />
          ) : view === 'months' ? (
            <View style={styles.monthGrid}>
              {MONTHS.map((name, m) => {
                const off = isFuture(shown.y, m);
                const on = shown.m === m;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`${name} ${shown.y}`}
                    accessibilityState={{ disabled: off, selected: on }}
                    disabled={off}
                    onPress={() => {
                      if (!ready()) return;
                      setShown({ y: shown.y, m });
                      setView('days');
                    }}
                    style={[styles.monthCell, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn, off && styles.off]}>{name.slice(0, 3)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View>
              <View style={styles.week}>
                {WEEKDAYS.map((w) => (
                  <Text key={w} style={[styles.weekday, { width: cell }]}>
                    {w.slice(0, 2)}
                  </Text>
                ))}
              </View>
              <View style={styles.days}>
                {Array.from({ length: new Date(shown.y, shown.m, 1).getDay() }, (_, i) => (
                  <View key={`gap${i}`} style={{ width: cell, height: cell }} />
                ))}
                {Array.from({ length: daysIn(shown.y, shown.m) }, (_, i) => {
                  const d = i + 1;
                  const off = isFuture(shown.y, shown.m, d);
                  const on = !!draft && draft.y === shown.y && draft.m === shown.m && draft.d === d;
                  const isToday = today.y === shown.y && today.m === shown.m && today.d === d;
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="button"
                      accessibilityLabel={`${d} ${MONTHS[shown.m]} ${shown.y}`}
                      accessibilityState={{ disabled: off, selected: on }}
                      disabled={off}
                      onPress={() => ready() && setDraft({ y: shown.y, m: shown.m, d })}
                      style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <View
                        style={[
                          styles.day,
                          { width: cell - 6, height: cell - 6, borderRadius: (cell - 6) / 2 },
                          isToday && !on && styles.today,
                          on && styles.dayOn,
                        ]}
                      >
                        <Text style={[styles.dayText, on && styles.dayTextOn, off && styles.off]}>{d}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerButton}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.footerButton}>
            <PrimaryButton title="Done" disabled={!draft} onPress={() => draft && onDone(format(draft))} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Arrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: AppIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
      hitSlop={6}
    >
      <Icon icon={icon} size={20} color={disabled ? theme.placeholder : theme.text} />
    </Pressable>
  );
}

/** Newest year first; opens scrolled to the selected year. */
function YearGrid({ selected, lastYear, onPick }: { selected: number; lastYear: number; onPick: (y: number) => void }) {
  const rows = useMemo(() => {
    const years = Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => lastYear - i);
    const out: number[][] = [];
    for (let i = 0; i < years.length; i += 4) out.push(years.slice(i, i + 4));
    return out;
  }, [lastYear]);
  const selectedRow = Math.max(0, Math.floor((lastYear - selected) / 4));
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r[0])}
      getItemLayout={(_, index) => ({ length: YEAR_ROW, offset: YEAR_ROW * index, index })}
      initialScrollIndex={Math.max(0, selectedRow - 2)}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <View style={styles.yearRow}>
          {item.map((y) => {
            const on = y === selected;
            return (
              <Pressable
                key={y}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onPick(y)}
                style={[styles.yearCell, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{y}</Text>
              </Pressable>
            );
          })}
          {Array.from({ length: 4 - item.length }, (_, i) => (
            <View key={`pad${i}`} style={styles.yearCell} />
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: theme.separator, marginBottom: 14 },
  caption: { fontSize: 13, fontWeight: '600', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 4 },
  heading: { fontSize: 26, fontWeight: '700', color: theme.text, marginTop: 4, paddingHorizontal: 4 },
  headingEmpty: { color: theme.placeholder },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8, paddingHorizontal: 4 },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  monthText: { fontSize: 17, fontWeight: '600', color: theme.text },
  arrows: { flexDirection: 'row', gap: 8 },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', marginBottom: 4 },
  weekday: { textAlign: 'center', fontSize: 13, fontWeight: '600', color: theme.muted },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: theme.primary },
  today: { borderWidth: 1.5, borderColor: theme.text },
  dayText: { fontSize: 17, color: theme.text, fontVariant: ['tabular-nums'] },
  dayTextOn: { color: theme.onPrimary, fontWeight: '700' },
  off: { color: theme.separator },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 8 },
  monthCell: { width: '31%', flexGrow: 1, height: 52, borderRadius: 26, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  yearRow: { height: YEAR_ROW, flexDirection: 'row', gap: 10, paddingVertical: 4 },
  yearCell: { flex: 1, borderRadius: 22, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: theme.primary },
  chipText: { fontSize: 16, fontWeight: '500', color: theme.text, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: theme.onPrimary, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 16 },
  footerButton: { flex: 1 },
  cancel: { height: 56, borderRadius: 28, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 17, fontWeight: '600', color: theme.text },
});
