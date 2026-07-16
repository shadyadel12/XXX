import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import {
  DAY_NAMES,
  DAY_SHORT,
  WEEK_ORDER_SAT_FIRST,
  todayDayOfWeek,
  todayISO,
} from '../../lib/dates';
import { listProgramDays } from '../../api/programs';
import { listWorkouts } from '../../api/workouts';
import { listExercises } from '../../api/exercises';
import { getLog, upsertLog } from '../../api/logs';
import { listSetLogs, replaceSetLogs } from '../../api/setLogs';
import { listMessagesForExercise, listMessagesForPlayer } from '../../api/messages';
import type { Exercise, ProgramDay, Workout } from '../../types/database.types';
import VideoPlayer from '../../components/VideoPlayer';
import VideoInput, { type VideoValue } from '../../components/VideoInput';

export default function PlayerProgram() {
  const { session, profile } = useAuth();
  const playerId = session!.user.id;
  const [week, setWeek] = useState(1);

  const { data: days, isLoading } = useQuery({
    queryKey: ['program', playerId],
    queryFn: () => listProgramDays(playerId),
  });

  const weeks = Array.from(new Set((days ?? []).map((d) => d.week_number))).sort((a, b) => a - b);
  const weekDays = (days ?? [])
    .filter((d) => d.week_number === week)
    .sort((a, b) => a.day_of_week - b.day_of_week);
  const byDow = new Map(weekDays.map((d) => [d.day_of_week, d]));

  const [selectedDow, setSelectedDow] = useState<number>(todayDayOfWeek());
  const selectedDay = byDow.get(selectedDow) ?? null;

  const { data: generalMessages } = useQuery({
    queryKey: ['playerMessages', playerId],
    queryFn: () => listMessagesForPlayer(playerId),
  });
  const general = (generalMessages ?? []).filter((m) => m.exercise_id === null);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Week {week}: Training program for {profile?.name ?? 'you'}</h1>
        {weeks.length > 0 && (
          <div className="field" style={{ margin: 0, minWidth: 120 }}>
            <label>Week</label>
            <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {weeks.map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && <p className="muted">Loading your program…</p>}

      {general.length > 0 && (
        <div className="card stack" style={{ gap: '0.4rem' }}>
          <strong>Messages from your coach</strong>
          {general.map((m) => (
            <div key={m.id}>
              💬 {m.body}
              <span className="muted" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                {new Date(m.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {!isLoading && weekDays.length === 0 && (
        <div className="card">
          <p className="muted">No program set for this week yet. Check back soon.</p>
        </div>
      )}

      {weekDays.length > 0 && (
        <>
          <div className="day-tabs">
            {WEEK_ORDER_SAT_FIRST.map((dow) => {
              const has = byDow.has(dow);
              const active = dow === selectedDow;
              return (
                <button
                  key={dow}
                  type="button"
                  className={`day-tab ${active ? 'active' : ''} ${has ? 'has-plan' : ''}`}
                  onClick={() => setSelectedDow(dow)}
                >
                  {DAY_SHORT[dow]}
                </button>
              );
            })}
          </div>

          {selectedDay ? (
            <DayPanel key={selectedDay.id} day={selectedDay} playerId={playerId} />
          ) : (
            <div className="card">
              <p className="muted">
                Nothing scheduled for {DAY_NAMES[selectedDow]}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The active day's panel. Contents always shown; workouts inside are collapsible. */
function DayPanel({ day, playerId }: { day: ProgramDay; playerId: string }) {
  const { data: workouts } = useQuery({
    queryKey: ['workouts', day.id],
    queryFn: () => listWorkouts(day.id),
    enabled: day.day_type === 'training',
  });

  return (
    <div className="card stack" style={{ gap: '0.5rem' }}>
      <div>
        <strong>{DAY_NAMES[day.day_of_week]}</strong>
        <span className="muted"> — {day.day_type === 'rest' ? 'Rest day' : 'Training'}</span>
      </div>

      {day.diet_plan && (
        <div>
          <strong style={{ fontSize: '0.9rem' }}>Diet plan</strong>
          <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: '0.2rem 0 0' }}>
            {day.diet_plan}
          </p>
        </div>
      )}
      {day.day_type === 'training' &&
        (workouts ?? []).map((w) => (
          <WorkoutAccordion key={w.id} workout={w} playerId={playerId} />
        ))}
      {day.day_type === 'training' && (workouts ?? []).length === 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>No workouts for this day.</p>
      )}
    </div>
  );
}

/** Level 2: a workout within a day. Collapsed by default. */
function WorkoutAccordion({ workout, playerId }: { workout: Workout; playerId: string }) {
  const [open, setOpen] = useState(false);

  const { data: exercises } = useQuery({
    queryKey: ['exercises', workout.id],
    queryFn: () => listExercises(workout.id),
    enabled: open,
  });

  return (
    <div className="card stack" style={{ background: 'var(--surface-2)', gap: '0.4rem' }}>
      <button
        className="secondary"
        style={{ textAlign: 'left', width: '100%', display: 'flex', justifyContent: 'space-between' }}
        onClick={() => setOpen((o) => !o)}
      >
        <strong>{workout.name}</strong>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open &&
        (exercises ?? []).map((ex) => (
          <ExerciseAccordion key={ex.id} exercise={ex} playerId={playerId} />
        ))}
      {open && (exercises ?? []).length === 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>No exercises.</p>
      )}
    </div>
  );
}

/** Level 3: an exercise. Collapsed by default; expands to log/upload. */
function ExerciseAccordion({ exercise, playerId }: { exercise: Exercise; playerId: string }) {
  const [open, setOpen] = useState(false);
  const logDate = todayISO();

  const { data: log } = useQuery({
    queryKey: ['log', exercise.id, playerId, logDate],
    queryFn: () => getLog(exercise.id, playerId, logDate),
    enabled: open,
  });

  const done = log?.is_completed ?? false;

  return (
    <div className="card stack" style={{ background: 'var(--surface)', gap: '0.4rem' }}>
      <button
        className="secondary"
        style={{ textAlign: 'left', width: '100%', display: 'flex', justifyContent: 'space-between' }}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <strong>{exercise.name}</strong>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {' '}· {exercise.target_sets ?? '—'}×{exercise.target_reps ?? '—'}
          </span>
        </span>
        <span>{done ? '✓ ' : ''}{open ? '▾' : '▸'}</span>
      </button>

      {open && <ExerciseBody exercise={exercise} playerId={playerId} logDate={logDate} />}
    </div>
  );
}

function ExerciseBody({
  exercise,
  playerId,
  logDate,
}: {
  exercise: Exercise;
  playerId: string;
  logDate: string;
}) {
  const qc = useQueryClient();

  const { data: log } = useQuery({
    queryKey: ['log', exercise.id, playerId, logDate],
    queryFn: () => getLog(exercise.id, playerId, logDate),
  });
  const { data: existingSets } = useQuery({
    queryKey: ['setlogs', log?.id],
    queryFn: () => (log?.id ? listSetLogs(log.id) : Promise.resolve([])),
    enabled: !!log?.id,
  });
  const { data: messages } = useQuery({
    queryKey: ['exmsg', exercise.id],
    queryFn: () => listMessagesForExercise(exercise.id),
  });

  // Per-set state: one row per set with reps + weight.
  type SetRow = { reps: string; weight: string };
  const targetCount = Math.max(1, exercise.target_sets ?? 1);
  const [rows, setRows] = useState<SetRow[]>(() =>
    Array.from({ length: targetCount }, () => ({ reps: '', weight: '' }))
  );
  const [comment, setComment] = useState('');
  const [video, setVideo] = useState<VideoValue>({ url: null, isExternal: false });
  const [initialized, setInitialized] = useState(false);

  // Hydrate from existing DB rows once loaded.
  if (log && !initialized && (existingSets !== undefined)) {
    if (existingSets.length > 0) {
      setRows(existingSets.map((s) => ({ reps: s.reps ?? '', weight: s.weight ?? '' })));
    } else if (log.actual_weight || log.actual_reps) {
      // Backward compat: a pre-per-set log with just summary columns. Seed one
      // row from the summary so the player doesn't lose it.
      setRows([{ reps: log.actual_reps ?? '', weight: log.actual_weight ?? '' }]);
    }
    setComment(log.player_comment ?? '');
    setVideo({ url: log.player_video_url, isExternal: log.player_video_is_external });
    setInitialized(true);
  }

  const setField = (i: number, patch: Partial<SetRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { reps: '', weight: '' }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = useMutation({
    mutationFn: async (completed: boolean) => {
      // Upsert the parent first to guarantee we have a log id. The trigger will
      // rewrite actual_sets/actual_reps/actual_weight from the child rows once
      // we replace them below.
      const parent = await upsertLog({
        exercise_id: exercise.id,
        player_id: playerId,
        log_date: logDate,
        actual_sets: rows.length,
        actual_reps: null,
        actual_weight: null,
        player_comment: comment || null,
        player_video_url: video.url,
        player_video_is_external: video.isExternal,
        is_completed: completed,
      });
      await replaceSetLogs(
        parent.id,
        rows.map((r) => ({ reps: r.reps || null, weight: r.weight || null }))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log', exercise.id, playerId, logDate] });
      qc.invalidateQueries({ queryKey: ['setlogs', log?.id] });
    },
  });

  const done = log?.is_completed ?? false;

  return (
    <div className="stack">
      {(exercise.target_weight || exercise.target_sets || exercise.target_reps) && (
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          Target: {exercise.target_sets ?? '—'} sets × {exercise.target_reps ?? '—'} reps
          {exercise.target_weight ? ` @ ${exercise.target_weight}` : ''}
        </div>
      )}
      {exercise.coach_comment && (
        <p style={{ margin: 0 }}>
          <span className="muted">Coach: </span>
          {exercise.coach_comment}
        </p>
      )}
      {exercise.coach_video_url && (
        <div>
          <span className="muted" style={{ fontSize: '0.8rem' }}>Coach's demo:</span>
          <VideoPlayer url={exercise.coach_video_url} isExternal={exercise.coach_video_is_external} />
        </div>
      )}
      {messages && messages.length > 0 && (
        <div className="stack" style={{ gap: '0.3rem' }}>
          {messages.map((m) => (
            <div key={m.id} className="muted" style={{ fontSize: '0.85rem' }}>💬 {m.body}</div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
        <strong style={{ fontSize: '0.85rem' }}>Log each set</strong>

        <div className="stack" style={{ marginTop: '0.5rem', gap: '0.4rem' }}>
          {rows.map((r, i) => (
            <div key={i} className="row" style={{ gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ minWidth: '3.5rem', fontWeight: 600 }}>Set {i + 1}</div>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>Reps</label>
                <input
                  value={r.reps}
                  onChange={(e) => setField(i, { reps: e.target.value })}
                  placeholder={exercise.target_reps ?? ''}
                />
              </div>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>Weight</label>
                <input
                  value={r.weight}
                  onChange={(e) => setField(i, { weight: e.target.value })}
                  placeholder={exercise.target_weight ?? '60kg'}
                />
              </div>
              {rows.length > 1 && (
                <button className="secondary" type="button" onClick={() => removeRow(i)} title="Remove this set">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="secondary" type="button" onClick={addRow} style={{ marginTop: '0.4rem' }}>
          + Add set
        </button>

        <div className="field" style={{ margin: '0.7rem 0 0' }}>
          <label>Your comment</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <VideoInput ownerId={playerId} value={video} onChange={setVideo} />
        </div>
        <div className="row" style={{ marginTop: '0.7rem' }}>
          <button onClick={() => save.mutate(done)} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save log'}
          </button>
          <button className={done ? 'danger' : 'secondary'} onClick={() => save.mutate(!done)} disabled={save.isPending}>
            {done ? 'Mark not done' : 'Mark done ✓'}
          </button>
          {save.error && <span className="error">{(save.error as Error).message}</span>}
        </div>
      </div>
    </div>
  );
}
