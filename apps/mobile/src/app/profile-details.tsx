import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { BirthdayField } from '../components/BirthdayField';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { ErrorBox, Field, PageHeader, PrimaryButton, Screen } from '../components/ui';
import { api, ApiError, type Gender } from '../lib/api';
import { birthdayProblem } from '../lib/dates';
import { t as translate, useI18n } from '../i18n';
import { useSession } from '../lib/session';
import { squircle, theme } from '../lib/theme';

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

/**
 * Profile details: photo, then one labelled field each for name, email (read-only), phone,
 * gender and birthday. "Save changes" appears once something has changed.
 */
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

  return (
    <Screen>
      <PageHeader title={t('profile.title')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProfilePhoto />

        <View>
          <Field
            label={t('profile.name')}
            accessibilityLabel={t('profile.name')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              edit('name');
            }}
            placeholder={t('profile.namePlaceholder')}
            autoComplete="name"
            maxLength={130}
          />
          <FieldError message={shown('name')} />
        </View>

        <Field
          label={t('profile.email')}
          accessibilityLabel={t('profile.email')}
          value={me.email ?? t('profile.noEmail')}
          editable={false}
          style={styles.readOnly}
        />

        <View>
          <Field
            label={t('profile.phone')}
            accessibilityLabel={t('profile.phone')}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              edit('phone');
            }}
            placeholder={t('profile.phonePlaceholder')}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={20}
          />
          <FieldError message={shown('phone')} />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>{t('profile.gender')}</Text>
          <View style={styles.genders} accessibilityRole="radiogroup">
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
                  style={({ pressed }) => [styles.gender, on && styles.genderOn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[styles.genderText, on && styles.genderTextOn]}>{t(g.label)}</Text>
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

        <ErrorBox message={error} />
        {/* The button appears only once something has changed; after saving, "Saved" takes its place. */}
        {changed || busy ? (
          <PrimaryButton title={t('profile.save')} onPress={() => void save()} loading={busy} style={styles.save} />
        ) : message ? (
          <Text style={styles.saved} accessibilityRole="alert">
            {message}
          </Text>
        ) : null}

        <Text style={styles.note}>{t('profile.note')}</Text>
      </ScrollView>
    </Screen>
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
  content: { paddingHorizontal: theme.gutter, gap: 18, paddingBottom: 40 },
  readOnly: { color: theme.muted },
  fieldWrap: { gap: 8 },
  // same as Field's label in components/ui
  label: { fontSize: 15, fontWeight: '600', color: theme.text },
  fieldError: { fontSize: 13, color: theme.danger, marginTop: 6, marginHorizontal: 4 },
  // Two equal pills, the size of the text fields; the chosen one is black, like the app's buttons.
  genders: { flexDirection: 'row', gap: 10 },
  gender: {
    ...squircle,
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOn: { backgroundColor: theme.primary },
  // same weight in both states, so choosing one doesn't shift the text
  genderText: { fontSize: 17, fontWeight: '500', color: theme.text },
  genderTextOn: { color: theme.onPrimary },
  save: { marginTop: 4 },
  saved: { fontSize: 15, fontWeight: '600', color: theme.success, textAlign: 'center', marginTop: 4 },
  note: { fontSize: 13, color: theme.muted, textAlign: 'center', paddingHorizontal: 12 },
});
