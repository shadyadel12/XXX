import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { DAY_NAMES, todayISO } from '../../lib/dates';
import { listProgramDays } from '../../api/programs';
import { listWorkouts } from '../../api/workouts';
import { listExercises } from '../../api/exercises';
import { getLog, upsertLog } from '../../api/logs';
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

      {weekDays.map((day) => (
        <DayAccordion key={day.id} day={day} playerId={playerId} />
      ))}
    </div>
  );
}

/** Level 1: a day. Collapsed by default. */
function DayAccordion({ day, playerId }: { day: ProgramDay; playerId: string }) {
  const [open, setOpen] = useState(false);

  const { data: workouts } = useQuery({
    queryKey: ['workouts', day.id],
    queryFn: () => listWorkouts(day.id),
    enabled: open && day.day_type === 'training',
  });

  return (
    <div className="card stack" style={{ gap: '0.5rem' }}>
      <button
        className="secondary"
        style={{ textAlign: 'left', width: '100%', display: 'flex', justifyContent: 'space-between' }}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <strong>{DAY_NAMES[day.day_of_week]}</strong>
          <span className="muted"> — {day.day_type === 'rest' ? 'Rest day' : 'Training'}</span>
        </span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="stack" style={{ paddingLeft: '0.5rem' }}>
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
  const { data: messages } = useQuery({
    queryKey: ['exmsg', exercise.id],
    queryFn: () => listMessagesForExercise(exercise.id),
  });

  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [comment, setComment] = useState('');
  const [video, setVideo] = useState<VideoValue>({ url: null, isExternal: false });
  const [initialized, setInitialized] = useState(false);

  if (log && !initialized) {
    setSets(log.actual_sets?.toString() ?? '');
    setReps(log.actual_reps ?? '');
    setComment(log.player_comment ?? '');
    setVideo({ url: log.player_video_url, isExternal: log.player_video_is_external });
    setInitialized(true);
  }

  const save = useMutation({
    mutationFn: (completed: boolean) =>
      upsertLog({
        exercise_id: exercise.id,
        player_id: playerId,
        log_date: logDate,
        actual_sets: sets ? Number(sets) : null,
        actual_reps: reps || null,
        player_comment: comment || null,
        player_video_url: video.url,
        player_video_is_external: video.isExternal,
        is_completed: completed,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['log', exercise.id, playerId, logDate] }),
  });

  const done = log?.is_completed ?? false;

  return (
    <div className="stack">
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
        <strong style={{ fontSize: '0.85rem' }}>Log your performance</strong>
        <div className="row" style={{ marginTop: '0.5rem' }}>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Sets done</label>
            <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Reps done</label>
            <input value={reps} onChange={(e) => setReps(e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ margin: '0.5rem 0 0' }}>
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
        </div>
      </div>
    </div>
  );
}
