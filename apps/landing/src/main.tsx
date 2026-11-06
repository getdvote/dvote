import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { Layout } from './components/layout';
import { I18nProvider } from './i18n';
import { HomePage } from './pages/home';
import './styles.css';

/** dvote.co: the landing page. "Log in" goes to the merchant dashboard (merchant.dvote.co). */
const router = createBrowserRouter([
  {
    element: (
      <Layout>
        <Outlet />
      </Layout>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      // one page: old addresses (e.g. the dashboard's "See plans" → /pricing) jump to the section
      { path: '/features', element: <Navigate to="/#features" replace /> },
      { path: '/pricing', element: <Navigate to="/#pricing" replace /> },
      { path: '/contact', element: <Navigate to="/#contact" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
);
