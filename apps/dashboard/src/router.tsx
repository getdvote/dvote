import { Flex, Spin } from 'antd';
import { createBrowserRouter, Route, Routes } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { VendorLayout } from './layouts/VendorLayout';
import { useAuth } from './lib/auth';
import { Customers } from './pages/Customers';
import { Login } from './pages/Login';
import { MyHome } from './pages/my/MyHome';
import { MyProfile } from './pages/my/MyProfile';
import { MyBranches, MyImages, MyRewards, MyRule, MyStaff } from './pages/my/MySections';
import { NotFound } from './pages/NotFound';
import { Overview } from './pages/Overview';
import { VendorDetail } from './pages/VendorDetail';
import { Vendors } from './pages/Vendors';

/**
 * Every page needs a signed-in account; otherwise the sign-in screen is shown in place.
 * A platform admin gets the admin pages (all vendors); a vendor account gets only its
 * own vendor's pages — those call /api/vendor, which scopes everything by the token.
 */
function Shell() {
  const { status, admin, staff } = useAuth();
  if (status === 'loading') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (status !== 'ready') return <Login />;

  if (admin) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AdminLayout>
    );
  }

  if (staff) {
    return (
      <VendorLayout>
        <Routes>
          <Route path="/" element={<MyHome />} />
          <Route path="/branches" element={<MyBranches />} />
          <Route path="/rule" element={<MyRule />} />
          <Route path="/rewards" element={<MyRewards />} />
          <Route path="/images" element={<MyImages />} />
          <Route path="/staff" element={<MyStaff />} />
          {staff.role === 'vendor_admin' ? <Route path="/profile" element={<MyProfile />} /> : null}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </VendorLayout>
    );
  }
  return <Login />;
}

export const router = createBrowserRouter([{ path: '*', element: <Shell /> }]);
