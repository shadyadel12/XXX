import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { DAY_NAMES } from '../../lib/dates';
import { getPlayerForCoach } from '../../api/players';
import { listProgramDays, upsertProgramDay } from '../../api/programs';
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

      <div className="stack">
        {DAY_NAMES.map((name, dow) => (
          <DayCard
            key={dow}
            playerId={playerId!}
            coachId={coachId}
            week={week}
            dayOfWeek={dow}
            dayName={name}
            existing={byDow.get(dow) ?? null}
          />
        ))}
      </div>
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
  const [open, setOpen] = useState(false);
  const [dayType, setDayType] = useState(existing?.day_type ?? 'training');
  const [diet, setDiet] = useState(existing?.diet_plan ?? '');

  const saveDay = useMutation({
    mutationFn: () =>
      upsertProgramDay({
        player_id: playerId,
        coach_id: coachId,
        week_number: week,
        day_of_week: dayOfWeek,
        day_type: dayType,
        title: existing?.title ?? null,
        diet_plan: diet || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['program', playerId] }),
  });

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
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
        <button className="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : existing ? 'Edit' : 'Set up'}
        </button>
      </div>

      {open && (
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

          <div className="row">
            <button onClick={() => saveDay.mutate()} disabled={saveDay.isPending}>
              {saveDay.isPending ? 'Saving…' : existing ? 'Save day' : 'Create day'}
            </button>
            {saveDay.error && <span className="error">{(saveDay.error as Error).message}</span>}
          </div>

          {existing && dayType === 'training' && <WorkoutList programDayId={existing.id} playerId={playerId} />}
          {!existing && dayType === 'training' && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Create the day first, then add workouts.
            </p>
          )}
        </div>
      )}
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
