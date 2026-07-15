import { supabase } from '../lib/supabase';
import type { Profile, CoachPlayerLink } from '../types/database.types';

export interface PlayerWithLink {
  profile: Profile | null; // null when the key is issued but not yet claimed
  link: CoachPlayerLink;
}

/**
 * All players linked to the given coach, with their subscription link.
 * Includes unclaimed keys (profile === null). RLS scopes this to the coach.
 */
export async function listPlayersForCoach(coachId: string): Promise<PlayerWithLink[]> {
  const { data: links, error } = await supabase
    .from('coach_player_links')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!links || links.length === 0) return [];

  const playerIds = links
    .map((l) => l.player_id)
    .filter((id): id is string => id !== null);

  let byId = new Map<string, Profile>();
  if (playerIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .in('id', playerIds);
    if (pErr) throw pErr;
    byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  return links.map((link) => ({
    profile: link.player_id ? byId.get(link.player_id) ?? null : null,
    link,
  }));
}

/** A single player's profile + their link to this coach. */
export async function getPlayerForCoach(
  coachId: string,
  playerId: string
): Promise<PlayerWithLink | null> {
  const { data: link, error } = await supabase
    .from('coach_player_links')
    .select('*')
    .eq('coach_id', coachId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (error) throw error;
  if (!link) return null;

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', playerId)
    .maybeSingle();
  if (pErr) throw pErr;
  return profile ? { profile, link } : null;
}

/** Most recent exercise-log date for a player (for "last activity"). */
export async function getLastActivity(playerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('log_date')
    .eq('player_id', playerId)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.log_date ?? null;
}
