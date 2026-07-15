import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, signOut } from '../../api/auth';
import { getMyProfile } from '../../api/profiles';

/** Email + password login for coaches (also reused shape for admin). */
export default function CoachLogin() {
  return <RoleLogin expectedRole="coach" title="Coach sign in" home="/coach/dashboard" />;
}

export function RoleLogin({
  expectedRole,
  title,
  home,
}: {
  expectedRole: 'coach' | 'admin';
  title: string;
  home: string;
}) {
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
      if (profile?.role !== expectedRole) {
        await signOut();
        throw new Error(`This account is not a ${expectedRole} account.`);
      }
      navigate(home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card stack" style={{ width: '100%', maxWidth: 380 }} onSubmit={handleSubmit}>
        <h2>{title}</h2>
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
          {expectedRole === 'coach' ? (
            <Link to="/signup/coach" className="muted">Create coach account</Link>
          ) : (
            <span />
          )}
          <Link to="/" className="muted">← Back</Link>
        </div>
      </form>
    </div>
  );
}
