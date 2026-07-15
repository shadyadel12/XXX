import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { validateSubscriptionKey } from '../../api/auth';

/** Shown when a player's subscription is missing/expired. */
export default function Blocked() {
  const { session, subscription, refreshSubscription, signOut } = useAuth();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setBusy(true);
    try {
      const info = await validateSubscriptionKey(session.user.id, key);
      await refreshSubscription();
      if (info.active) {
        navigate('/player/program', { replace: true });
      } else {
        setError('That key is still expired. Please contact your coach to renew.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not validate key.');
    } finally {
      setBusy(false);
    }
  }

  const expiredDate = subscription?.link?.subscription_end_date;

  return (
    <div className="center-screen">
      <div className="card stack" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <h2>Subscription expired</h2>
        <p className="muted">
          Your subscription has expired
          {expiredDate ? ` (ended ${expiredDate})` : ''}. Please renew with your coach
          to view your training program.
        </p>

        <form className="stack" onSubmit={handleRenew}>
          <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            Already renewed? Enter your updated key:
          </p>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="KEY-XXXX-XXXX" required />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>

        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
