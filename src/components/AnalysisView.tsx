import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlayerAnalysis, groupByExerciseName } from '../api/analysis';
import { todayISO } from '../lib/dates';

/** Shared analysis view: totals + per-exercise session-over-session comparison. */
export default function AnalysisView({ playerId }: { playerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analysis', playerId],
    queryFn: () => getPlayerAnalysis(playerId),
  });

  type Range = 'all' | 'today' | 'week' | 'month';
  const [workoutFilter, setWorkoutFilter] = useState<string>('');
  const [exerciseFilter, setExerciseFilter] = useState<string>('');
  const [range, setRange] = useState<Range>('all');

  const filtered = useMemo(() => {
    if (!data) return { groups: [], totalCompleted: 0, totalLogged: 0 };
    const all = groupByExerciseName(data);
    const rangeStart = rangeStartISO(range); // null = no lower bound
    const today = todayISO();

    const byWorkout = workoutFilter
      ? all.filter((g) => g.workoutTitles.includes(workoutFilter))
      : all;
    const byExercise = exerciseFilter
      ? byWorkout.filter((g) => g.exerciseName === exerciseFilter)
      : byWorkout;

    // Filter logs inside each group by the date range, then drop empty groups.
    const groups = byExercise
      .map((g) => ({
        ...g,
        logs: g.logs.filter((l) => {
          if (range === 'today') return l.log_date === today;
          if (rangeStart) return l.log_date >= rangeStart && l.log_date <= today;
          return true;
        }),
      }))
      .filter((g) => g.logs.length > 0);

    let totalCompleted = 0;
    let totalLogged = 0;
    for (const g of groups) {
      totalLogged += g.logs.length;
      totalCompleted += g.logs.filter((l) => l.is_completed).length;
    }
    return { groups, totalCompleted, totalLogged };
  }, [data, workoutFilter, exerciseFilter, range]);

  // Options for the dropdowns come from the UNFILTERED analysis, so switching
  // between filters never accidentally hides an option.
  const options = useMemo(() => {
    if (!data) return { workouts: [] as string[], exercises: [] as string[] };
    const all = groupByExerciseName(data);
    const workouts = new Set<string>();
    const exercises = new Set<string>();
    for (const g of all) {
      exercises.add(g.exerciseName);
      for (const w of g.workoutTitles) workouts.add(w);
    }
    return { workouts: [...workouts].sort(), exercises: [...exercises].sort() };
  }, [data]);

  if (isLoading) return <p className="muted">Loading analysis…</p>;
  if (error) return <p className="error">{(error as Error).message}</p>;
  if (!data) return null;

  const filterActive = !!workoutFilter || !!exerciseFilter || range !== 'all';

  return (
    <div className="stack">
      {/* Filters */}
      <div className="card row" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label>Workout</label>
          <select value={workoutFilter} onChange={(e) => setWorkoutFilter(e.target.value)}>
            <option value="">All workouts</option>
            {options.workouts.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label>Exercise</label>
          <select value={exerciseFilter} onChange={(e) => setExerciseFilter(e.target.value)}>
            <option value="">All exercises</option>
            {options.exercises.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
          <label>Range</label>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="all">All time</option>
            <option value="today">Today only</option>
            <option value="week">This week (Sat–Fri)</option>
            <option value="month">This month</option>
          </select>
        </div>
        {filterActive && (
          <button
            className="secondary"
            type="button"
            onClick={() => { setWorkoutFilter(''); setExerciseFilter(''); setRange('all'); }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="row" style={{ gap: '1rem' }}>
        <StatCard label={filterActive ? 'Completed (filtered)' : 'Workouts completed'} value={filtered.totalCompleted} />
        <StatCard label={filterActive ? 'Sessions (filtered)' : 'Sessions logged'} value={filtered.totalLogged} />
        <StatCard label="Exercises shown" value={filtered.groups.length} />
      </div>

      {filtered.groups.length === 0 && (
        <div className="card">
          <p className="muted">
            {filterActive
              ? 'No sessions match the current filters.'
              : 'No logged sessions yet. Data appears once workouts are logged.'}
          </p>
        </div>
      )}

      {filtered.groups.map((group) => {
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
                    <th style={cell}>Weight</th>
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
                    const wNow = parseWeight(l.actual_weight);
                    const wPrev = prev ? parseWeight(prev.actual_weight) : null;
                    const weightUp = wNow != null && wPrev != null ? wNow - wPrev : null;
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
                        <td style={cell}>
                          {l.actual_weight ?? '—'}
                          {weightUp != null && weightUp !== 0 && (
                            <span className={weightUp > 0 ? 'trend-up' : 'trend-down'}>
                              {' '}
                              {weightUp > 0 ? `▲${weightUp}` : `▼${Math.abs(weightUp)}`}
                            </span>
                          )}
                        </td>
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

/** Parse the leading number out of a weight string like "60kg" -> 60. */
function parseWeight(w: string | null): number | null {
  if (!w) return null;
  const m = w.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Start date (YYYY-MM-DD) for a filter range.
 * - week: most recent Saturday (or today if today is Saturday)
 * - month: 1st of the current month
 * Returns null for 'all' / 'today' (today is handled separately).
 */
function rangeStartISO(range: 'all' | 'today' | 'week' | 'month'): string | null {
  if (range === 'all' || range === 'today') return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (range === 'month') {
    return `${y}-${String(m + 1).padStart(2, '0')}-01`;
  }
  // range === 'week' : back up to the most recent Saturday.
  // JS getDay(): Sun=0, Mon=1, ..., Sat=6.
  const daysSinceSat = (now.getDay() + 1) % 7; // Sat=0, Sun=1, ..., Fri=6
  const start = new Date(y, m, now.getDate() - daysSinceSat);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: '0.8rem' }}>{label}</div>
    </div>
  );
}
