import { ChatSquareWarningIcon as MessageSquareWarning } from '@solar-icons/react/linear';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n';

/** Customer feedback: nothing yet. */
export function MyFeedback() {
  return <PlaceholderPage title={t('nav.feedback')} subtitle={t('feedback.subtitle')} icon={MessageSquareWarning} />;
}
