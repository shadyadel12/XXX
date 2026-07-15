import { supabase } from '../lib/supabase';
import type { Workout } from '../types/database.types';

/** Workouts for a program day, ordered by position. */
export async function listWorkouts(programDayId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('program_day_id', programDayId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createWorkout(
  programDayId: string,
  name: string,
  position = 0
): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ program_day_id: programDayId, name, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorkout(id: string, name: string): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}
