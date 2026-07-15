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
