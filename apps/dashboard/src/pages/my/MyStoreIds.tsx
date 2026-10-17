import { BoxIcon as KitIcon } from '@solar-icons/react/linear';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n';

/** Branch QR/NFC materials and holder orders. */
export function MyStoreIds() {
  return <PlaceholderPage title={t('nav.storeIds')} subtitle={t('storeIds.subtitle')} icon={KitIcon} />;
}
