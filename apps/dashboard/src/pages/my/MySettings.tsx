import { SettingsIcon as Settings } from '@solar-icons/react/linear';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n';

/** Account and dashboard settings: nothing yet (the shop's own settings are on Storefront). */
export function MySettings() {
  return <PlaceholderPage title={t('nav.settings')} subtitle={t('settings.subtitle')} icon={Settings} />;
}
