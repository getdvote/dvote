import { Loader2 } from 'lucide-react';
import { createBrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { VendorLayout } from './layouts/VendorLayout';
import { useAuth } from './lib/auth';
import { Customers } from './pages/Customers';
import { Login } from './pages/Login';
import { MyActivity } from './pages/my/MyActivity';
import { MyHome } from './pages/my/MyHome';
import { MyInsights } from './pages/my/MyInsights';
import { MyProfile } from './pages/my/MyProfile';
import { MyRedemptions } from './pages/my/MyRedemptions';
import { MyBranches, MyImages, MyRewards, MyRule, MyStaff } from './pages/my/MySections';
import { Overview } from './pages/Overview';
import { Statistics } from './pages/Statistics';
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (status !== 'ready') return <Login />;

  if (admin) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/merchants" element={<Vendors />} />
          <Route path="/merchants/:id" element={<VendorDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    );
  }

  if (staff) {
    return (
      <VendorLayout>
        <Routes>
          <Route path="/" element={<MyHome />} />
          <Route path="/insights" element={<MyInsights />} />
          <Route path="/activity" element={<MyActivity />} />
          <Route path="/branches" element={<MyBranches />} />
          <Route path="/rule" element={<MyRule />} />
          <Route path="/rewards" element={<MyRewards />} />
          <Route path="/redemptions" element={<MyRedemptions />} />
          <Route path="/menu" element={<MyImages />} />
          <Route path="/staff" element={<MyStaff />} />
          {staff.role === 'vendor_admin' ? <Route path="/profile" element={<MyProfile />} /> : null}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </VendorLayout>
    );
  }
  return <Login />;
}

export const router = createBrowserRouter([{ path: '*', element: <Shell /> }]);
