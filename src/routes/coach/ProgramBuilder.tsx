import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { DAY_NAMES, DAY_SHORT, WEEK_ORDER_SAT_FIRST, todayDayOfWeek } from '../../lib/dates';
import { getPlayerForCoach } from '../../api/players';
import {
  listProgramDays,
  upsertProgramDay,
  createFullDay,
  duplicateWeek,
  type DraftWorkoutData,
} from '../../api/programs';
import { listWorkouts, createWorkout, updateWorkout, deleteWorkout } from '../../api/workouts';
import {
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
} from '../../api/exercises';
import type { Exercise, ProgramDay, Workout } from '../../types/database.types';
import VideoInput, { type VideoValue } from '../../components/VideoInput';

export default function ProgramBuilder() {
  const { playerId } = useParams<{ playerId: string }>();
  const { session } = useAuth();
  const coachId = session!.user.id;
  const [week, setWeek] = useState(1);

  const { data: player } = useQuery({
    queryKey: ['player', coachId, playerId],
    queryFn: () => getPlayerForCoach(coachId, playerId!),
    enabled: !!playerId,
  });

  const { data: days } = useQuery({
    queryKey: ['program', playerId],
    queryFn: () => listProgramDays(playerId!),
    enabled: !!playerId,
  });

  const weekDays = (days ?? []).filter((d) => d.week_number === week);
  const byDow = new Map(weekDays.map((d) => [d.day_of_week, d]));
  const qc = useQueryClient();

  // Which day tab is active. Defaults to today's weekday.
  const [selectedDow, setSelectedDow] = useState<number>(todayDayOfWeek());
  const selectedExisting = byDow.get(selectedDow) ?? null;

  const [dupTo, setDupTo] = useState(week + 1);
  const duplicate = useMutation({
    mutationFn: () => duplicateWeek(playerId!, coachId, week, dupTo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['program', playerId] }),
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <Link to="/coach/dashboard" className="muted" style={{ fontSize: '0.85rem' }}>
            ← Dashboard
          </Link>
          <h1 style={{ margin: '0.2rem 0 0' }}>
            Program — {player?.profile?.name ?? player?.profile?.email ?? '…'}
          </h1>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 120 }}>
          <label>Week</label>
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {weekDays.length > 0 && (
        <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Copy Week {week}'s full schedule to another week (overwrites the target week):
          </span>
          <div className="row" style={{ gap: '0.5rem' }}>
            <select
              value={dupTo}
              onChange={(e) => setDupTo(Number(e.target.value))}
              style={{ width: 'auto' }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1)
                .filter((w) => w !== week)
                .map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
            </select>
            <button
              onClick={() => {
                if (confirm(`Copy Week ${week} to Week ${dupTo}? This overwrites Week ${dupTo}.`)) {
                  duplicate.mutate();
                }
              }}
              disabled={duplicate.isPending}
            >
              {duplicate.isPending ? 'Copying…' : 'Duplicate week'}
            </button>
          </div>
          {duplicate.isSuccess && (
            <span className="badge active">Copied to Week {dupTo} ✓</span>
          )}
          {duplicate.error && <span className="error">{(duplicate.error as Error).message}</span>}
        </div>
      )}

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

      <DayCard
        key={`${week}-${selectedDow}`}
        playerId={playerId!}
        coachId={coachId}
        week={week}
        dayOfWeek={selectedDow}
        dayName={DAY_NAMES[selectedDow]}
        existing={selectedExisting}
      />
    </div>
  );
}

function DayCard({
  playerId,
  coachId,
  week,
  dayOfWeek,
  dayName,
  existing,
}: {
  playerId: string;
  coachId: string;
  week: number;
  dayOfWeek: number;
  dayName: string;
  existing: ProgramDay | null;
}) {
  const qc = useQueryClient();
  const [dayType, setDayType] = useState(existing?.day_type ?? 'training');
  const [diet, setDiet] = useState(existing?.diet_plan ?? '');
  // Draft workouts (each with draft exercises) for a not-yet-created day.
  const [draftWorkouts, setDraftWorkouts] = useState<DraftWorkoutData[]>([]);

  const saveDay = useMutation({
    mutationFn: async () => {
      const base = {
        player_id: playerId,
        coach_id: coachId,
        week_number: week,
        day_of_week: dayOfWeek,
        day_type: dayType,
        title: existing?.title ?? null,
        diet_plan: diet || null,
      };
      if (!existing && dayType === 'training' && draftWorkouts.length > 0) {
        await createFullDay(base, draftWorkouts);
      } else {
        await upsertProgramDay(base);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program', playerId] });
      setDraftWorkouts([]);
    },
  });

  return (
    <div className="card stack">
      <div>
        <strong>{dayName}</strong>{' '}
        {existing ? (
          <span className="muted">
            — {existing.day_type === 'rest' ? 'Rest day' : 'Training'}
          </span>
        ) : (
          <span className="muted">— not set</span>
        )}
      </div>

      <div className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
        <div className="row">
          <label className="row" style={{ gap: '0.4rem' }}>
            <input type="radio" style={{ width: 'auto' }} checked={dayType === 'training'} onChange={() => setDayType('training')} />
            Training day
          </label>
          <label className="row" style={{ gap: '0.4rem' }}>
            <input type="radio" style={{ width: 'auto' }} checked={dayType === 'rest'} onChange={() => setDayType('rest')} />
            Rest day
          </label>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label>Diet plan (optional)</label>
          <textarea rows={2} value={diet} onChange={(e) => setDiet(e.target.value)} />
        </div>

        {/* New training day: build workouts + exercises before the first save. */}
        {!existing && dayType === 'training' && (
          <DraftWorkoutsEditor drafts={draftWorkouts} setDrafts={setDraftWorkouts} />
        )}

        <div className="row">
          <button onClick={() => saveDay.mutate()} disabled={saveDay.isPending}>
            {saveDay.isPending ? 'Saving…' : existing ? 'Save day' : 'Create day'}
          </button>
          {saveDay.error && <span className="error">{(saveDay.error as Error).message}</span>}
        </div>

        {/* Existing training day: live workout editor. */}
        {existing && dayType === 'training' && <WorkoutList programDayId={existing.id} playerId={playerId} />}
      </div>
    </div>
  );
}

// ---- Draft editors (for a day that doesn't exist in the DB yet) ----

function DraftWorkoutsEditor({
  drafts,
  setDrafts,
}: {
  drafts: DraftWorkoutData[];
  setDrafts: React.Dispatch<React.SetStateAction<DraftWorkoutData[]>>;
}) {
  const addWorkout = () =>
    setDrafts((ds) => [...ds, { name: '', exercises: [] }]);
  const removeWorkout = (i: number) =>
    setDrafts((ds) => ds.filter((_, idx) => idx !== i));
  const setWorkoutName = (i: number, name: string) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, name } : d)));
  const addExercise = (i: number) =>
    setDrafts((ds) =>
      ds.map((d, idx) =>
        idx === i
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                {
                  name: '',
                  target_sets: 3,
                  target_reps: '10',
                  target_weight: null,
                  coach_comment: null,
                  coach_video_url: null,
                  coach_video_is_external: false,
                },
              ],
            }
          : d
      )
    );
  const setExercise = (wi: number, ei: number, patch: Partial<DraftWorkoutData['exercises'][number]>) =>
    setDrafts((ds) =>
      ds.map((d, idx) =>
        idx === wi
          ? { ...d, exercises: d.exercises.map((ex, j) => (j === ei ? { ...ex, ...patch } : ex)) }
          : d
      )
    );
  const removeExercise = (wi: number, ei: number) =>
    setDrafts((ds) =>
      ds.map((d, idx) =>
        idx === wi ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d
      )
    );

  return (
    <div className="stack" style={{ marginTop: '0.3rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Workouts</strong>
      {drafts.length === 0 && (
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          Add workouts and exercises now — they'll be saved together with the day.
        </p>
      )}
      {drafts.map((w, wi) => (
        <div key={wi} className="card stack" style={{ background: 'var(--surface-2)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Workout name</label>
              <input value={w.name} onChange={(e) => setWorkoutName(wi, e.target.value)} placeholder="Push" />
            </div>
            <button className="danger" style={{ alignSelf: 'flex-end' }} type="button" onClick={() => removeWorkout(wi)}>
              Remove
            </button>
          </div>

          {w.exercises.map((ex, ei) => (
            <div key={ei} className="card stack" style={{ background: 'var(--surface)' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Exercise name</label>
                <input value={ex.name} onChange={(e) => setExercise(wi, ei, { name: e.target.value })} placeholder="Chest Press" />
              </div>
              <div className="row">
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label>Target sets</label>
                  <input
                    type="number"
                    value={ex.target_sets ?? ''}
                    onChange={(e) => setExercise(wi, ei, { target_sets: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label>Target reps</label>
                  <input
                    value={ex.target_reps ?? ''}
                    onChange={(e) => setExercise(wi, ei, { target_reps: e.target.value || null })}
                    placeholder="8-12"
                  />
                </div>
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label>Target weight</label>
                  <input
                    value={ex.target_weight ?? ''}
                    onChange={(e) => setExercise(wi, ei, { target_weight: e.target.value || null })}
                    placeholder="60kg"
                  />
                </div>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Comment</label>
                <textarea
                  rows={2}
                  value={ex.coach_comment ?? ''}
                  onChange={(e) => setExercise(wi, ei, { coach_comment: e.target.value || null })}
                />
              </div>
              <button className="danger" type="button" onClick={() => removeExercise(wi, ei)}>
                Remove exercise
              </button>
            </div>
          ))}

          <button className="secondary" type="button" onClick={() => addExercise(wi)}>
            + Add exercise
          </button>
        </div>
      ))}
      <button className="secondary" type="button" onClick={addWorkout}>
        + Add workout
      </button>
    </div>
  );
}

function WorkoutList({ programDayId, playerId }: { programDayId: string; playerId: string }) {
  const qc = useQueryClient();
  const { data: workouts } = useQuery({
    queryKey: ['workouts', programDayId],
    queryFn: () => listWorkouts(programDayId),
  });

  const addWorkout = useMutation({
    mutationFn: () => createWorkout(programDayId, 'New workout', (workouts?.length ?? 0)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts', programDayId] }),
  });

  return (
    <div className="stack" style={{ marginTop: '0.5rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Workouts</strong>
      {(workouts ?? []).map((w) => (
        <WorkoutCard key={w.id} workout={w} programDayId={programDayId} playerId={playerId} />
      ))}
      <button className="secondary" onClick={() => addWorkout.mutate()} disabled={addWorkout.isPending}>
        + Add workout
      </button>
    </div>
  );
}

function WorkoutCard({
  workout,
  programDayId,
  playerId,
}: {
  workout: Workout;
  programDayId: string;
  playerId: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(workout.name);

  const rename = useMutation({
    mutationFn: () => updateWorkout(workout.id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts', programDayId] }),
  });
  const del = useMutation({
    mutationFn: () => deleteWorkout(workout.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts', programDayId] }),
  });

  return (
    <div className="card stack" style={{ background: 'var(--surface-2)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Workout name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push" onBlur={() => name !== workout.name && rename.mutate()} />
        </div>
        <button className="danger" style={{ alignSelf: 'flex-end' }} onClick={() => del.mutate()} disabled={del.isPending}>
          Delete workout
        </button>
      </div>
      <ExerciseEditor workoutId={workout.id} playerId={playerId} />
    </div>
  );
}

function ExerciseEditor({ workoutId, playerId }: { workoutId: string; playerId: string }) {
  const qc = useQueryClient();
  const { data: exercises } = useQuery({
    queryKey: ['exercises', workoutId],
    queryFn: () => listExercises(workoutId),
  });

  const addEx = useMutation({
    mutationFn: () =>
      createExercise({
        workout_id: workoutId,
        name: 'New exercise',
        target_sets: 3,
        target_reps: '10',
        target_weight: null,
        coach_video_url: null,
        coach_video_is_external: false,
        coach_comment: null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises', workoutId] }),
  });

  return (
    <div className="stack" style={{ marginTop: '0.3rem' }}>
      {(exercises ?? []).map((ex) => (
        <ExerciseRow key={ex.id} exercise={ex} playerId={playerId} workoutId={workoutId} />
      ))}
      <button className="secondary" onClick={() => addEx.mutate()} disabled={addEx.isPending}>
        + Add exercise
      </button>
    </div>
  );
}

function ExerciseRow({
  exercise,
  playerId,
  workoutId,
}: {
  exercise: Exercise;
  playerId: string;
  workoutId: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.target_sets?.toString() ?? '');
  const [reps, setReps] = useState(exercise.target_reps ?? '');
  const [weight, setWeight] = useState(exercise.target_weight ?? '');
  const [comment, setComment] = useState(exercise.coach_comment ?? '');
  const [video, setVideo] = useState<VideoValue>({
    url: exercise.coach_video_url,
    isExternal: exercise.coach_video_is_external,
  });

  const save = useMutation({
    mutationFn: () =>
      updateExercise(exercise.id, {
        name,
        target_sets: sets ? Number(sets) : null,
        target_reps: reps || null,
        target_weight: weight || null,
        coach_comment: comment || null,
        coach_video_url: video.url,
        coach_video_is_external: video.isExternal,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises', workoutId] }),
  });

  const del = useMutation({
    mutationFn: () => deleteExercise(exercise.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises', workoutId] }),
  });

  return (
    <div className="card stack" style={{ background: 'var(--surface)' }}>
      <div className="field" style={{ margin: 0 }}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row">
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Target sets</label>
          <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Target reps</label>
          <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8-12" />
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Target weight</label>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="60kg" />
        </div>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label>Comment</label>
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <VideoInput ownerId={playerId} value={video} onChange={setVideo} />
      <div className="row">
        <button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button className="danger" onClick={() => del.mutate()} disabled={del.isPending}>
          Delete
        </button>
        {save.error && <span className="error">{(save.error as Error).message}</span>}
      </div>
    </div>
  );
}
