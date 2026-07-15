import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { getPlayerForCoach } from '../../api/players';
import AnalysisView from '../../components/AnalysisView';

/** Coach's view of a linked player's performance history. */
export default function PlayerAnalysis() {
  const { playerId } = useParams<{ playerId: string }>();
  const { session } = useAuth();
  const coachId = session!.user.id;

  const { data: player } = useQuery({
    queryKey: ['player', coachId, playerId],
    queryFn: () => getPlayerForCoach(coachId, playerId!),
    enabled: !!playerId,
  });

  return (
    <div className="stack">
      <div>
        <Link to="/coach/dashboard" className="muted" style={{ fontSize: '0.85rem' }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: '0.2rem 0 0' }}>
          Analysis — {player?.profile?.name ?? player?.profile?.email ?? '…'}
        </h1>
      </div>
      {playerId && <AnalysisView playerId={playerId} />}
    </div>
  );
}
