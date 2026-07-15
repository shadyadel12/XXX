import { useQuery } from '@tanstack/react-query';
import { getPlayerAnalysis, groupByExerciseName } from '../api/analysis';

/** Shared analysis view: totals + per-exercise session-over-session comparison. */
export default function AnalysisView({ playerId }: { playerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analysis', playerId],
    queryFn: () => getPlayerAnalysis(playerId),
  });

  if (isLoading) return <p className="muted">Loading analysis…</p>;
  if (error) return <p className="error">{(error as Error).message}</p>;
  if (!data) return null;

  const groups = groupByExerciseName(data);

  return (
    <div className="stack">
      <div className="row" style={{ gap: '1rem' }}>
        <StatCard label="Workouts completed" value={data.totalCompleted} />
        <StatCard label="Sessions logged" value={data.totalLogged} />
        <StatCard label="Exercises tracked" value={groups.length} />
      </div>

      {groups.length === 0 && (
        <div className="card">
          <p className="muted">No logged sessions yet. Data appears once workouts are logged.</p>
        </div>
      )}

      {groups.map((group) => {
        const { exerciseName: name, workoutTitles, logs } = group;
        return (
        <div key={name} className="card stack">
          <div>
            <strong>{name}</strong>
            {workoutTitles.length > 0 && (
              <span className="muted" style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                — {workoutTitles.join(', ')}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={cell}>Date</th>
                  <th style={cell}>Sets</th>
                  <th style={cell}>Reps</th>
                  <th style={cell}>Done</th>
                  <th style={cell}>Note</th>
                  <th style={cell}>Video</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => {
                  const prev = logs[i - 1];
                  const setsUp =
                    prev && l.actual_sets != null && prev.actual_sets != null
                      ? l.actual_sets - prev.actual_sets
                      : null;
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={cell}>{l.log_date}</td>
                      <td style={cell}>
                        {l.actual_sets ?? '—'}
                        {setsUp != null && setsUp !== 0 && (
                          <span className={setsUp > 0 ? 'trend-up' : 'trend-down'}>
                            {' '}
                            {setsUp > 0 ? `▲${setsUp}` : `▼${Math.abs(setsUp)}`}
                          </span>
                        )}
                      </td>
                      <td style={cell}>{l.actual_reps ?? '—'}</td>
                      <td style={cell}>{l.is_completed ? '✓' : '—'}</td>
                      <td style={cell}>{l.player_comment ?? ''}</td>
                      <td style={cell}>
                        {l.player_video_url ? (l.player_video_is_external ? '🔗' : '🎬') : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}
    </div>
  );
}

const cell: React.CSSProperties = { padding: '0.4rem 0.6rem' };

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: '0.8rem' }}>{label}</div>
    </div>
  );
}
