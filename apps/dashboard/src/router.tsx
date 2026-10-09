import { Flex, Spin } from 'antd';
import { createBrowserRouter, Outlet } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { useAuth } from './lib/auth';
import { Customers } from './pages/Customers';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Overview } from './pages/Overview';
import { VendorDetail } from './pages/VendorDetail';
import { Vendors } from './pages/Vendors';

/** Every page needs a signed-in platform admin; otherwise the sign-in screen is shown in place. */
function RequireAdmin() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (status !== 'ready') return <Login />;
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

export const router = createBrowserRouter([
  {
    element: <RequireAdmin />,
    children: [
      { path: '/', element: <Overview /> },
      { path: '/vendors', element: <Vendors /> },
      { path: '/vendors/:id', element: <VendorDetail /> },
      { path: '/customers', element: <Customers /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
