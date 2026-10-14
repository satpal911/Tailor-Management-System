import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const adminOnlyPaths = [
  '/app/dashboard',
  '/app/catalog',
  '/app/team',
  '/app/reports',
  '/app/settings',
  '/app/audit-logs',
];
const tailorOnlyPaths = ['/app/tailor-dashboard', '/app/assigned'];

function loginPath(pathname) {
  if (adminOnlyPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)))
    return '/admin/login';
  if (tailorOnlyPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)))
    return '/tailor/login';
  return '/login';
}

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="screen-center">
        <span className="spinner" />
      </div>
    );
  if (!user) return <Navigate to={loginPath(location.pathname)} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <Outlet />;
}
