import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listPlayersForCoach, type PlayerWithLink } from '../../api/players';
import { isSubscriptionActive } from '../../api/auth';

export default function CoachDashboard() {
  const { session } = useAuth();
  const coachId = session!.user.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['players', coachId],
    queryFn: () => listPlayersForCoach(coachId),
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Your Players</h1>
      </div>

      {isLoading && <p className="muted">Loading players…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="card">
          <p className="muted">
            No players yet. Ask the admin to issue a subscription key for a new
            player — once they sign up with it, they'll appear here.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="stack">
          {data.map((p) => (
            <PlayerRow key={p.link.id} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerWithLink }) {
  const active = isSubscriptionActive(player.link);
  const claimed = player.profile !== null;
  const displayName = player.profile?.name ?? player.profile?.email ?? 'Unclaimed key';

  return (
    <div className="card row" style={{ justifyContent: 'space-between' }}>
      <div>
        <strong>{displayName}</strong>
        {player.profile && (
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {player.profile.email}
          </div>
        )}
        <div style={{ marginTop: '0.4rem' }}>
          <span className={`badge ${active ? 'active' : 'expired'}`}>
            {active ? 'Active' : 'Expired'}
          </span>{' '}
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            key {player.link.subscription_key} · ends {player.link.subscription_end_date}
          </span>
        </div>
      </div>
      <div className="row">
        {claimed && player.profile ? (
          <>
            <Link to={`/coach/players/${player.profile.id}/program`}>
              <button>Program</button>
            </Link>
            <Link to={`/coach/players/${player.profile.id}/analysis`}>
              <button className="secondary">Analysis</button>
            </Link>
            <Link to={`/coach/players/${player.profile.id}/messages`}>
              <button className="secondary">Messages</button>
            </Link>
          </>
        ) : (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Key not yet claimed
          </span>
        )}
      </div>
    </div>
  );
}
