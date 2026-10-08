import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { BirthdayField } from '../components/BirthdayField';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { ErrorBox, Group, PageHeader, Screen } from '../components/ui';
import { api, ApiError, type Gender } from '../lib/api';
import { birthdayProblem } from '../lib/dates';
import { t as translate, useI18n } from '../i18n';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

const GENDERS: { value: Gender; label: 'profile.male' | 'profile.female' }[] = [
  { value: 'male', label: 'profile.male' },
  { value: 'female', label: 'profile.female' },
];

/** Spaces and dashes people type in phone numbers ("0120 289-8477") are dropped. */
const cleanPhone = (v: string) => v.replace(/[\s-]/g, '');

/** Same rules as the API (PATCH /api/app/users/me). */
function problems(f: { name: string; phone: string; birthDate: string | null }) {
  const name = f.name.trim();
  const phone = cleanPhone(f.phone);
  return {
    name: !name ? translate('profile.nameEmpty') : name.length > 120 ? translate('profile.nameLong') : null,
    phone:
      phone && !/^\+?[0-9]{7,15}$/.test(phone)
        ? translate('profile.phoneInvalid')
        : null,
    birthDate: f.birthDate ? birthdayProblem(f.birthDate) : null,
  };
}

/** Profile details design: photo, name, email, phone, gender, birthday, "Save changes". */
export default function ProfileDetails() {
  const { me, setMe, handleAuthError } = useSession();
  const { t } = useI18n();
  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [gender, setGender] = useState<Gender | null>(me?.gender ?? null);
  const [birthDate, setBirthDate] = useState<string | null>(me?.birthDate ?? null);
  const [touched, setTouched] = useState({ name: false, phone: false, birthDate: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!me) return <Redirect href="/(tabs)/you" />;

  const errors = problems({ name, phone, birthDate });
  const valid = !errors.name && !errors.phone && !errors.birthDate;
  const changed =
    name.trim() !== (me.name ?? '') ||
    cleanPhone(phone) !== (me.phone ?? '') ||
    gender !== me.gender ||
    birthDate !== me.birthDate;
  // a field's message shows once the customer has edited that field
  const shown = (field: keyof typeof touched) => (touched[field] ? errors[field] : null);
  const edit = (field?: keyof typeof touched) => {
    setMessage(null);
    setError(null);
    if (field) setTouched((t) => ({ ...t, [field]: true }));
  };

  async function save() {
    if (!valid) {
      setTouched({ name: true, phone: true, birthDate: true });
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const p = cleanPhone(phone);
      setMe(
        await api.updateMe({
          name: name.trim(),
          ...(p ? { phone: p } : {}),
          ...(gender !== me!.gender ? { gender } : {}),
          ...(birthDate !== me!.birthDate ? { birthDate } : {}),
        }),
      );
      setPhone(p);
      setMessage(t('profile.saved'));
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('profile.couldNotSave'));
    } finally {
      setBusy(false);
    }
  }

  const canSave = changed && valid && !busy;

  return (
    <Screen>
      <PageHeader title={t('profile.title')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProfilePhoto />
        <Group>
          <Field error={shown('name')}>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                edit('name');
              }}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={theme.placeholder}
              style={styles.input}
              autoComplete="name"
              maxLength={130}
              accessibilityLabel={t('profile.namePlaceholder')}
            />
          </Field>
          <Field>
            <Text style={[styles.input, styles.readOnly]} numberOfLines={1}>
              {me.email ?? t('profile.noEmail')}
            </Text>
          </Field>
          <Field error={shown('phone')}>
            <TextInput
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                edit('phone');
              }}
              placeholder={t('profile.phonePlaceholder')}
              placeholderTextColor={theme.placeholder}
              style={styles.input}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={20}
              accessibilityLabel={t('profile.phonePlaceholder')}
            />
          </Field>

          <View style={styles.fieldRow}>
            <Text style={styles.label}>{t('profile.gender')}</Text>
            <View style={styles.segments} accessibilityRole="radiogroup">
              {GENDERS.map((g) => {
                const on = gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    // tapping the chosen one again clears it
                    onPress={() => {
                      setGender(on ? null : g.value);
                      edit();
                    }}
                    style={[styles.segment, on && styles.segmentOn]}
                  >
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t(g.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <BirthdayField
              value={birthDate}
              onChange={(v) => {
                setBirthDate(v);
                edit('birthDate');
              }}
            />
            <FieldError message={shown('birthDate')} />
          </View>

          <Pressable accessibilityRole="button" disabled={!canSave} onPress={() => void save()} style={styles.saveRow}>
            <Text style={[styles.save, !canSave && styles.saveOff]}>{busy ? t('profile.saving') : message ?? t('profile.save')}</Text>
          </Pressable>
        </Group>
        <ErrorBox message={error} />
        <Text style={styles.note}>
          {t('profile.note')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Field({ children, error }: { children: ReactNode; error?: string | null }) {
  return (
    <View>
      <View style={styles.inputRow}>{children}</View>
      <FieldError message={error ?? null} />
    </View>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.fieldError} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, gap: 14, paddingBottom: 40 },
  inputRow: { height: theme.rowHeight, justifyContent: 'center' },
  input: { fontSize: 17, color: theme.text, paddingVertical: 0 },
  readOnly: { color: theme.muted },
  fieldRow: { minHeight: theme.rowHeight, flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1, fontSize: 17, color: theme.text },
  fieldError: { fontSize: 13, color: theme.danger, marginTop: -6, marginBottom: 10 },
  segments: { flexDirection: 'row', backgroundColor: theme.fill, borderRadius: 18, padding: 3 },
  segment: { paddingHorizontal: 16, height: 32, borderRadius: 16, justifyContent: 'center' },
  segmentOn: { backgroundColor: theme.surface },
  segmentText: { fontSize: 15, color: theme.muted, fontWeight: '500' },
  segmentTextOn: { color: theme.text, fontWeight: '600' },
  saveRow: { height: theme.rowHeight, alignItems: 'center', justifyContent: 'center' },
  save: { fontSize: 17, color: theme.link },
  saveOff: { color: theme.placeholder },
  note: { fontSize: 13, color: theme.muted, textAlign: 'center', paddingHorizontal: 12 },
});
