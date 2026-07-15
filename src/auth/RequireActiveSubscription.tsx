import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

/**
 * Wraps player pages that require an active subscription (program, analysis).
 * If the subscription is missing or expired, redirect to the Blocked page.
 */
export default function RequireActiveSubscription({ children }: { children: ReactNode }) {
  const { loading, subscription } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!subscription?.active) {
    return <Navigate to="/player/blocked" replace />;
  }

  return <>{children}</>;
}
