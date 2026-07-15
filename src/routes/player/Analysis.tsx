import { useAuth } from '../../auth/AuthContext';
import AnalysisView from '../../components/AnalysisView';

/** Player's own performance history. */
export default function PlayerAnalysis() {
  const { session } = useAuth();
  return (
    <div className="stack">
      <h1>My Progress</h1>
      <AnalysisView playerId={session!.user.id} />
    </div>
  );
}
