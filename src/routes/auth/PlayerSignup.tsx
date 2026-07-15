import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp, signIn, claimSubscriptionKey, checkSubscriptionKey, signOut } from '../../api/auth';

/** Player self-serve signup: name + email + password + subscription key. */
export default function PlayerSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1) Validate the key BEFORE creating any account (no orphan accounts).
      const valid = await checkSubscriptionKey(key);
      if (!valid) {
        throw new Error('Invalid or already-used subscription key.');
      }
      // 2) Create the account, then claim the key.
      await signUp(email, password, name);
      // With email confirmation off, signUp returns a session; if not, sign in.
      await signIn(email, password).catch(() => {});
      await claimSubscriptionKey(key);
      // Full reload so AuthContext loads the fresh subscription.
      window.location.assign('/player/program');
    } catch (err) {
      await signOut().catch(() => {});
      setError(err instanceof Error ? err.message : 'Signup failed.');
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card stack" style={{ width: '100%', maxWidth: 400 }} onSubmit={handleSubmit}>
        <h2>Player sign up</h2>
        <p className="muted" style={{ marginTop: '-0.5rem', fontSize: '0.85rem' }}>
          Enter the subscription key your coach gave you.
        </p>
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        </div>
        <div className="field">
          <label>Subscription key</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} required placeholder="KEY-XXXX-XXXX" />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/login/player" className="muted">Already have an account?</Link>
          <Link to="/" className="muted">← Back</Link>
        </div>
      </form>
    </div>
  );
}
