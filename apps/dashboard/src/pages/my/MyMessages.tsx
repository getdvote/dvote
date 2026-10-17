import { SmartphoneVibrationIcon as Megaphone } from '@solar-icons/react/linear';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n';

/** Broadcast: messages to all customers at once. Nothing yet. */
export function MyMessages() {
  return <PlaceholderPage title={t('nav.messages')} subtitle={t('messages.subtitle')} icon={Megaphone} />;
}
