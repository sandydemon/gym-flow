import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGymStatus } from '@/hooks/useGymStatus';
import { useUserRole, GymRole, ROLE_ROUTES } from '@/hooks/useUserRole';

interface Props {
  children: ReactNode;
  /** Restrict to a specific subset of roles. If omitted, any logged-in role is allowed. */
  allowedRoles?: GymRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();
  const { loading: gymLoading, recheckStatus } = useGymStatus();
  const { data: roleInfo, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  useEffect(() => {
    if (user && !loading) {
      recheckStatus();
    }
  }, [user, loading, location.pathname, recheckStatus]);

  if (loading || gymLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/gym-auth" replace />;
  }

  const role = roleInfo?.role;

  // Explicit role gate (e.g. owner-only pages)
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={defaultLanding(role)} replace />;
  }

  // Implicit gate from ROLE_ROUTES table
  if (role && role !== 'owner' && role !== 'admin') {
    const allowed = ROLE_ROUTES[role];
    const ok = allowed.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    if (!ok) return <Navigate to={defaultLanding(role)} replace />;
  }

  return <>{children}</>;
}

function defaultLanding(role: GymRole): string {
  if (role === 'trainer') return '/paid-training';
  if (role === 'receptionist') return '/members';
  return '/dashboard';
}
