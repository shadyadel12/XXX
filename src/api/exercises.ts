import { supabase } from '../lib/supabase';
import type { Exercise } from '../types/database.types';

/** Exercises for a workout, ordered by position. */
export async function listExercises(workoutId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('workout_id', workoutId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ExerciseInput {
  workout_id: string;
  position?: number;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  coach_video_url: string | null;
  coach_video_is_external: boolean;
  coach_comment: string | null;
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase.from('exercises').insert(input).select().single();
  if (error) throw error;
  return data;
}

/** Insert several exercises at once (used when saving a brand-new workout). */
export async function createExercises(inputs: ExerciseInput[]): Promise<Exercise[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase.from('exercises').insert(inputs).select();
  if (error) throw error;
  return data ?? [];
}

export async function updateExercise(
  id: string,
  patch: Partial<ExerciseInput>
): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}
