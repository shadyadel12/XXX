import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, signOut } from '../../api/auth';
import { getMyProfile } from '../../api/profiles';

/**
 * Player login: email + password only. The subscription key was entered once at
 * signup and links the account in the DB. If the subscription has expired, the
 * player still logs in but is routed to the Blocked page to enter a new key.
 */
export default function PlayerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await signIn(email, password);
      const profile = await getMyProfile(user.id);
      if (profile?.role !== 'player') {
        await signOut();
        throw new Error('This account is not a player account.');
      }
      // AuthContext loads the subscription; the route guard decides program vs.
      // the Blocked (renewal) page if it has expired.
      navigate('/player/program', { replace: true });
    } catch (err) {
      await signOut().catch(() => {});
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card stack" style={{ width: '100%', maxWidth: 380 }} onSubmit={handleSubmit}>
        <h2>Player sign in</h2>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/signup/player" className="muted">Create player account</Link>
          <Link to="/" className="muted">← Back</Link>
        </div>
      </form>
    </div>
  );
}
