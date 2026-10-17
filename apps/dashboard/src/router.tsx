import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { createBrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { VendorLayout } from './layouts/VendorLayout';
import { useAuth } from './lib/auth';
import { Customers } from './pages/Customers';
import { Login } from './pages/Login';
import { MyActivity } from './pages/my/MyActivity';
import { MyCustomers } from './pages/my/my-customers';
import { MyHome } from './pages/my/MyHome';
import { MyInsights } from './pages/my/MyInsights';
import { MyProfile } from './pages/my/MyProfile';
import { MyCard } from './pages/my/MyCard';
import { MyFeedback } from './pages/my/MyFeedback';
import { MyMessages } from './pages/my/MyMessages';
import { MyStoreIds } from './pages/my/MyStoreIds';
import { MySettings } from './pages/my/MySettings';
import { MyTill } from './pages/my/MyTill';
import { MyBranches, MyRewards, MyStaff } from './pages/my/MySections';
import { Overview } from './pages/Overview';
import { Statistics } from './pages/Statistics';
import { System } from './pages/System';
import { VendorDetail } from './pages/VendorDetail';
import { Vendors } from './pages/Vendors';

/**
 * Every page needs a signed-in account; otherwise the sign-in screen is shown in place.
 * A platform admin gets the admin pages (all vendors); a vendor account gets only its
 * own vendor's pages — those call /api/vendor, which scopes everything by the token. Plain staff
 * get the till only.
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
          <Route path="/system" element={<System />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    );
  }

  // Plain staff (cashiers) get the till only.
  if (staff?.role === 'staff') {
    return (
      <VendorLayout>
        <Routes>
          <Route path="/scan" element={<MyTill />} />
          <Route path="*" element={<Navigate to="/scan" replace />} />
        </Routes>
      </VendorLayout>
    );
  }

  if (staff) {
    return (
      <VendorLayout>
        <Routes>
          <Route path="/" element={<MyHome />} />
          <Route path="/scan" element={<MyTill />} />
          <Route path="/customers" element={<MyCustomers />} />
          <Route path="/insights" element={<MyInsights />} />
          <Route path="/activity" element={<MyActivity />} />
          <Route path="/branches" element={<MyBranches />} />
          <Route path="/card" element={<MyCard />} />
          <Route path="/rule" element={<Navigate to="/card" replace />} />
          <Route path="/rewards" element={<MyRewards />} />
          <Route path="/redemptions" element={<Navigate to="/rewards?tab=redemptions" replace />} />
          <Route path="/menu" element={<Navigate to="/storefront" replace />} />
          <Route path="/staff" element={<MyStaff />} />
          {staff.role === 'vendor_admin' ? <Route path="/storefront" element={<MyProfile />} /> : null}
          {/* old links (bookmarks) to the storefront */}
          <Route path="/profile" element={<Navigate to="/storefront" replace />} />
          <Route path="/settings" element={<MySettings />} />
          <Route path="/feedback" element={<MyFeedback />} />
          <Route path="/broadcast" element={<MyMessages />} />
          <Route path="/messages" element={<Navigate to="/broadcast" replace />} />
          <Route path="/kit" element={<MyStoreIds />} />
          <Route path="/badges" element={<Navigate to="/kit" replace />} />
          {/* old names of this page */}
          <Route path="/info-chips" element={<Navigate to="/kit" replace />} />
          <Route path="/store-ids" element={<Navigate to="/kit" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </VendorLayout>
    );
  }
  return <Login />;
}

export const router = createBrowserRouter([{ path: '*', element: <Shell /> }]);
