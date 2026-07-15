import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { UserRole } from '../types/database.types';

/** Route guard: requires the user to be logged in with the given role. */
export default function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { loading, session, role: myRole } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/login/${role}`} replace />;
  }

  if (myRole !== role) {
    // Logged in but wrong role — send to their own home.
    return <Navigate to={homeFor(myRole)} replace />;
  }

  return <>{children}</>;
}

export function homeFor(role: UserRole | null): string {
  switch (role) {
    case 'coach':
      return '/coach/dashboard';
    case 'player':
      return '/player/program';
    case 'admin':
      return '/admin/coaches';
    default:
      return '/';
  }
}
