import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database.types';

/** Load the current user's profile row (role, name, email). */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
