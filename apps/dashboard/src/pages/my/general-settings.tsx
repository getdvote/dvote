import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from '../../components/Field';
import { useMe, useMyVendor } from '../../layouts/VendorLayout';
import { LANGUAGES, t, useI18n, type Language } from '../../i18n';

const DVOTE_EMAIL = 'getdvote@gmail.com';
/** Every report, day and opening time in the dashboard is Cairo time. */
const TIME_ZONE = 'Africa/Cairo';
const NOTIFICATIONS = ['weeklySummary', 'unusualActivity', 'soldOut', 'teamJoined'] as const;

/**
 * Settings → General: account-wide choices. Language is saved in this browser; time zone and
 * currency are set by dvote (read-only); email notifications and closing the account come later.
 */
export function GeneralSettings() {
  const me = useMe();
  const vendor = useMyVendor();
  const { language, setLanguage } = useI18n();
  const closeMail = `mailto:${DVOTE_EMAIL}?subject=${encodeURIComponent(t('general.closeSubject', { shop: vendor.name }))}`;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('general.language')}</CardTitle>
          <CardDescription>{t('general.languageHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger className="w-full sm:w-64" aria-label={t('general.language')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} lang={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('general.region')}</CardTitle>
          <CardDescription>{t('general.regionHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label={t('general.timeZone')} htmlFor="general-tz" hint={t('general.timeZoneHint')}>
            <Input id="general-tz" readOnly disabled dir="ltr" value={`${t('general.cairo')} (${TIME_ZONE})`} />
          </Field>
          <Field label={t('profile.currency')} htmlFor="general-currency" hint={t('profile.currencyHint')}>
            <Input id="general-currency" readOnly disabled dir="ltr" value={vendor.currency} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('general.notifications')} <Badge variant="outline">{t('staff.soon')}</Badge>
          </CardTitle>
          <CardDescription>{t('general.notificationsHint', { email: me.email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {NOTIFICATIONS.map((n) => (
              <li key={n} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{t(`general.emails.${n}.label`)}</p>
                <p className="text-xs text-muted-foreground">{t(`general.emails.${n}.hint`)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {me.role === 'vendor_admin' ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>{t('general.close')}</CardTitle>
            <CardDescription>{t('general.closeText')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="text-destructive" asChild>
              <a href={closeMail}>{t('general.closeAction')}</a>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
