import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import AppLayout from '../components/AppLayout.jsx';
import { Loading } from '../components/UI.jsx';
import { ROLES } from '../utils/constants.js';

const Landing = lazy(() => import('../pages/Landing.jsx'));
const RoleSelection = lazy(() => import('../pages/RoleSelection.jsx'));
const AuthPage = lazy(() => import('../pages/AuthPage.jsx'));
const Dashboard = lazy(() => import('../pages/Dashboard.jsx'));
const Orders = lazy(() => import('../pages/Orders.jsx'));
const OrderDetail = lazy(() => import('../pages/OrderDetail.jsx'));
const Customers = lazy(() => import('../pages/Customers.jsx'));
const Measurements = lazy(() => import('../pages/Measurements.jsx'));
const Payments = lazy(() => import('../pages/Payments.jsx'));
const Appointments = lazy(() => import('../pages/Appointments.jsx'));
const Catalog = lazy(() => import('../pages/Catalog.jsx'));
const Team = lazy(() => import('../pages/Team.jsx'));
const Notifications = lazy(() => import('../pages/Notifications.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));
const Reports = lazy(() => import('../pages/Reports.jsx'));
const Settings = lazy(() => import('../pages/Settings.jsx'));
const Payroll = lazy(() => import('../pages/Payroll.jsx'));
const AuditLogs = lazy(() => import('../pages/AuditLogs.jsx'));
const TailorDashboard = lazy(() =>
  import('../pages/RoleDashboards.jsx').then((module) => ({ default: module.TailorDashboard })),
);
const CustomerDashboard = lazy(() =>
  import('../pages/RoleDashboards.jsx').then((module) => ({ default: module.CustomerDashboard })),
);

function HomeRedirect() {
  const { user } = useAuth();
  return (
    <Navigate
      to={
        user?.role === ROLES.CUSTOMER
          ? '/app/customer-dashboard'
          : user?.role === ROLES.TAILOR
            ? '/app/tailor-dashboard'
            : '/app/dashboard'
      }
      replace
    />
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/access" element={<RoleSelection />} />
        <Route path="/login" element={<AuthPage mode="customer" />} />
        <Route path="/register" element={<AuthPage mode="customer-register" />} />
        <Route path="/admin/login" element={<AuthPage mode="admin" />} />
        <Route path="/tailor/login" element={<AuthPage mode="tailor" />} />
        <Route path="/tailor/register" element={<AuthPage mode="tailor-register" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="team" element={<Team />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>
            <Route element={<ProtectedRoute roles={[ROLES.CUSTOMER]} />}>
              <Route path="customer-dashboard" element={<CustomerDashboard />} />
              <Route path="my-orders" element={<Orders />} />
              <Route path="my-orders/new" element={<Orders create />} />
              <Route path="my-orders/:id" element={<OrderDetail />} />
            </Route>
            <Route element={<ProtectedRoute roles={[ROLES.TAILOR]} />}>
              <Route path="tailor-dashboard" element={<TailorDashboard />} />
              <Route path="assigned" element={<Orders assigned />} />
              <Route path="assigned/:id" element={<OrderDetail />} />
            </Route>
            <Route element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.CUSTOMER]} />}>
              <Route path="orders" element={<Orders />} />
              <Route path="orders/new" element={<Orders create />} />
              <Route path="orders/:id" element={<OrderDetail />} />
            </Route>
            <Route element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.TAILOR]} />}>
              <Route path="customers" element={<Customers />} />
              <Route path="payroll" element={<Payroll />} />
            </Route>
            <Route path="measurements" element={<Measurements />} />
            <Route path="payments" element={<Payments />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
