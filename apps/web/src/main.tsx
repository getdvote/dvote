import { FeedbackPage } from './pages/feedback-page';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { I18nProvider } from './i18n';
import { configProblem } from './lib/config';
import { CardPage } from './pages/CardPage';
import { WalletPage } from './pages/wallet-page';
import { HomePage, PrivacyPage, TermsPage } from './pages/InfoPages';
import { JoinPage } from './pages/JoinPage';
import { VenuePage, VenueSectionPage } from './pages/VenuePage';
import './styles.css';

/**
 * m.dvote.co routes. Fixed words come first (they are reserved merchant slugs in the database:
 * see vendor_slug_reserved in migration 16), then m.dvote.co/<merchant-slug>.
 */
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/c/:publicId/wallet', element: <WalletPage /> },
  { path: '/c/:publicId', element: <CardPage /> },
  { path: '/:slug', element: <VenuePage /> },
  { path: '/:slug/feedback', element: <FeedbackPage /> },
  { path: '/:slug/join', element: <JoinPage /> },
  { path: '/:slug/rewards', element: <VenueSectionPage kind="rewards" /> },
  { path: '/:slug/menu', element: <VenueSectionPage kind="menu" /> },
  { path: '/:slug/branches', element: <VenueSectionPage kind="branches" /> },
  { path: '*', element: <HomePage /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      {configProblem ? <p style={{ padding: 24 }}>{configProblem}</p> : <RouterProvider router={router} />}
    </I18nProvider>
  </StrictMode>,
);
