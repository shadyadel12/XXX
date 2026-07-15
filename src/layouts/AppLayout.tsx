import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Shared shell: top bar with nav links + sign out. */
export default function AppLayout({
  links,
}: {
  links: { to: string; label: string }[];
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div>
      <header className="topbar">
        <div className="row" style={{ gap: '1.5rem' }}>
          <strong>Coach Platform</strong>
          <nav>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="row">
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {profile?.name ?? profile?.email}
          </span>
          <button className="secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
