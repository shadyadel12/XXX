import { supabase } from '../lib/supabase';
import type { SetLog } from '../types/database.types';

/** All set rows for a given exercise_log, ordered Set 1..N. */
export async function listSetLogs(exerciseLogId: string): Promise<SetLog[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*')
    .eq('exercise_log_id', exerciseLogId)
    .order('set_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Replace the entire set of rows for an exercise_log in one shot.
 * The parent's actual_sets / actual_reps / actual_weight summary columns are
 * kept in sync by a DB trigger.
 */
export async function replaceSetLogs(
  exerciseLogId: string,
  sets: { reps: string | null; weight: string | null }[]
): Promise<SetLog[]> {
  // Wipe existing rows first (simpler than diff), then bulk insert.
  const { error: delErr } = await supabase
    .from('set_logs')
    .delete()
    .eq('exercise_log_id', exerciseLogId);
  if (delErr) throw delErr;

  if (sets.length === 0) return [];

  const payload = sets.map((s, i) => ({
    exercise_log_id: exerciseLogId,
    set_number: i + 1,
    reps: s.reps,
    weight: s.weight,
  }));
  const { data, error } = await supabase.from('set_logs').insert(payload).select();
  if (error) throw error;
  return data ?? [];
}
