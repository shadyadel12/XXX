import { supabase } from '../lib/supabase';
import type { ProgramDay, DayType } from '../types/database.types';

/** All program days for a player, ordered by week then day-of-week. */
export async function listProgramDays(playerId: string): Promise<ProgramDay[]> {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('player_id', playerId)
    .order('week_number', { ascending: true })
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** A single program day by (player, week, day-of-week), or null. */
export async function getProgramDay(
  playerId: string,
  week: number,
  dayOfWeek: number
): Promise<ProgramDay | null> {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('player_id', playerId)
    .eq('week_number', week)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface UpsertProgramDayInput {
  player_id: string;
  coach_id: string;
  week_number: number;
  day_of_week: number;
  day_type: DayType;
  title: string | null;
  diet_plan: string | null;
}

/** Create or update a program day (unique on player+week+day-of-week). */
export async function upsertProgramDay(input: UpsertProgramDayInput): Promise<ProgramDay> {
  const { data, error } = await supabase
    .from('program_days')
    .upsert(input, { onConflict: 'player_id,week_number,day_of_week' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProgramDay(id: string): Promise<void> {
  const { error } = await supabase.from('program_days').delete().eq('id', id);
  if (error) throw error;
}

// ---- Draft shapes for building a whole day (day -> workouts -> exercises) ----

export interface DraftExerciseData {
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  coach_comment: string | null;
  coach_video_url: string | null;
  coach_video_is_external: boolean;
}

export interface DraftWorkoutData {
  name: string;
  exercises: DraftExerciseData[];
}

/**
 * Create a full training day at once: the program_day, its workouts, and each
 * workout's exercises. Used when the coach builds a new day before saving.
 */
export async function createFullDay(
  base: UpsertProgramDayInput,
  workouts: DraftWorkoutData[]
): Promise<void> {
  const day = await upsertProgramDay(base);
  for (let wi = 0; wi < workouts.length; wi++) {
    const w = workouts[wi];
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ program_day_id: day.id, name: w.name || 'Workout', position: wi })
      .select()
      .single();
    if (wErr) throw wErr;
    if (w.exercises.length > 0) {
      const { error: eErr } = await supabase.from('exercises').insert(
        w.exercises.map((ex, ei) => ({
          workout_id: workout.id,
          position: ei,
          name: ex.name,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          coach_comment: ex.coach_comment,
          coach_video_url: ex.coach_video_url,
          coach_video_is_external: ex.coach_video_is_external,
        }))
      );
      if (eErr) throw eErr;
    }
  }
}

/**
 * Copy every day (with its workouts + exercises) from one week into another for
 * the same player. Player LOGS are not copied — only the plan. Existing days in
 * the target week for the same day-of-week are overwritten.
 */
export async function duplicateWeek(
  playerId: string,
  coachId: string,
  fromWeek: number,
  toWeek: number
): Promise<number> {
  const { data: days, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('player_id', playerId)
    .eq('week_number', fromWeek);
  if (error) throw error;
  if (!days || days.length === 0) return 0;

  // Clear the target week first so we don't stack duplicate workouts onto an
  // existing day (workouts/exercises cascade-delete with the day).
  const { error: delErr } = await supabase
    .from('program_days')
    .delete()
    .eq('player_id', playerId)
    .eq('week_number', toWeek);
  if (delErr) throw delErr;

  for (const d of days) {
    const base: UpsertProgramDayInput = {
      player_id: playerId,
      coach_id: coachId,
      week_number: toWeek,
      day_of_week: d.day_of_week,
      day_type: d.day_type,
      title: d.title,
      diet_plan: d.diet_plan,
    };

    if (d.day_type === 'rest') {
      await upsertProgramDay(base);
      continue;
    }

    // Read this day's workouts + exercises.
    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_day_id', d.id)
      .order('position');
    const drafts: DraftWorkoutData[] = [];
    for (const w of workouts ?? []) {
      const { data: exs } = await supabase
        .from('exercises')
        .select('*')
        .eq('workout_id', w.id)
        .order('position');
      drafts.push({
        name: w.name,
        exercises: (exs ?? []).map((ex) => ({
          name: ex.name,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          coach_comment: ex.coach_comment,
          coach_video_url: ex.coach_video_url,
          coach_video_is_external: ex.coach_video_is_external,
        })),
      });
    }
    await createFullDay(base, drafts);
  }
  return days.length;
}
