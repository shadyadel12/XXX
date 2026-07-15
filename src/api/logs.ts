import { supabase } from '../lib/supabase';
import type { ExerciseLog } from '../types/database.types';

/** Logs for a player, optionally filtered to a set of exercises. */
export async function listLogsForPlayer(
  playerId: string,
  exerciseIds?: string[]
): Promise<ExerciseLog[]> {
  let q = supabase.from('exercise_logs').select('*').eq('player_id', playerId);
  if (exerciseIds && exerciseIds.length > 0) {
    q = q.in('exercise_id', exerciseIds);
  }
  const { data, error } = await q.order('log_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** The log for a specific exercise on a specific date, if any. */
export async function getLog(
  exerciseId: string,
  playerId: string,
  logDate: string
): Promise<ExerciseLog | null> {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('exercise_id', exerciseId)
    .eq('player_id', playerId)
    .eq('log_date', logDate)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface UpsertLogInput {
  exercise_id: string;
  player_id: string;
  log_date: string;
  actual_sets: number | null;
  actual_reps: string | null;
  player_video_url: string | null;
  player_video_is_external: boolean;
  player_comment: string | null;
  is_completed: boolean;
}

/** Create/update a player's log for an exercise+date. */
export async function upsertLog(input: UpsertLogInput): Promise<ExerciseLog> {
  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert(input, { onConflict: 'exercise_id,player_id,log_date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
