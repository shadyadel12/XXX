import { supabase } from '../lib/supabase';
import type { Checkup } from '../types/database.types';

/** Checkups for a coach on a given date. */
export async function listCheckupsForDate(coachId: string, date: string): Promise<Checkup[]> {
  const { data, error } = await supabase
    .from('checkups')
    .select('*')
    .eq('coach_id', coachId)
    .eq('check_date', date);
  if (error) throw error;
  return data ?? [];
}

/** Set (upsert) a player's checked state for a date. */
export async function setCheckup(
  coachId: string,
  playerId: string,
  date: string,
  isChecked: boolean
): Promise<Checkup> {
  const { data, error } = await supabase
    .from('checkups')
    .upsert(
      { coach_id: coachId, player_id: playerId, check_date: date, is_checked: isChecked },
      { onConflict: 'coach_id,player_id,check_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
