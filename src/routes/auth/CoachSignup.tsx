import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp, signIn, claimCoachKey, checkCoachKey, signOut } from '../../api/auth';

/** Coach self-serve signup: name + email + password + single-use coach key. */
export default function CoachSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [coachKey, setCoachKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 1) Validate the key BEFORE creating any account (no orphan accounts).
      const valid = await checkCoachKey(coachKey);
      if (!valid) {
        throw new Error('Invalid or already-used coach key.');
      }
      // 2) Create the account, then consume the key to become a coach.
      await signUp(email, password, name);
      await signIn(email, password).catch(() => {});
      await claimCoachKey(coachKey);
      // Full reload so AuthContext re-fetches the profile with the new role.
      window.location.assign('/coach/dashboard');
    } catch (err) {
      await signOut().catch(() => {});
      setError(err instanceof Error ? err.message : 'Signup failed.');
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card stack" style={{ width: '100%', maxWidth: 400 }} onSubmit={handleSubmit}>
        <h2>Coach sign up</h2>
        <p className="muted" style={{ marginTop: '-0.5rem', fontSize: '0.85rem' }}>
          Requires a coach key issued by the admin.
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
          <label>Coach key</label>
          <input value={coachKey} onChange={(e) => setCoachKey(e.target.value)} required placeholder="KEY-COACH-XXXX" />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/login/coach" className="muted">Already have an account?</Link>
          <Link to="/" className="muted">← Back</Link>
        </div>
      </form>
    </div>
  );
}
