import { supabase } from '../lib/supabase';
import type { CoachKey, CoachPlayerLink, LinkStatus, Profile } from '../types/database.types';

/** All coaches (admin-only; RLS admin policy allows reading all profiles). */
export async function listCoaches(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'coach')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** All subscription keys/links (admin-only). */
export async function listAllKeys(): Promise<CoachPlayerLink[]> {
  const { data, error } = await supabase
    .from('coach_player_links')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Generate a readable random key like KEY-AB12-CD34. */
export function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `KEY-${block()}-${block()}`;
}

/** Generate a coach key like KEY-COACH-AB12. */
export function generateCoachKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `KEY-COACH-${block()}`;
}

// ---- Coach keys (single-use, admin-issued) ----

export async function listCoachKeys(): Promise<CoachKey[]> {
  const { data, error } = await supabase
    .from('coach_keys')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminCreateCoachKey(key: string): Promise<CoachKey> {
  const { data, error } = await supabase.rpc('admin_create_coach_key', { p_key: key });
  if (error) throw error;
  return data as CoachKey;
}

export async function adminRevokeCoachKey(keyId: string): Promise<CoachKey> {
  const { data, error } = await supabase.rpc('admin_revoke_coach_key', { p_key_id: keyId });
  if (error) throw error;
  return data as CoachKey;
}

/** Admin issues a new (unclaimed) key for a coach with an expiry date (RPC). */
export async function adminCreateKey(
  coachId: string,
  key: string,
  endDate: string
): Promise<CoachPlayerLink> {
  const { data, error } = await supabase.rpc('admin_create_key', {
    p_coach_id: coachId,
    p_key: key,
    p_end_date: endDate,
  });
  if (error) throw error;
  return data as CoachPlayerLink;
}

/** Admin renews / revokes a key (RPC). */
export async function adminUpdateKey(
  keyId: string,
  endDate: string,
  status: LinkStatus
): Promise<CoachPlayerLink> {
  const { data, error } = await supabase.rpc('admin_update_key', {
    p_key_id: keyId,
    p_end_date: endDate,
    p_status: status,
  });
  if (error) throw error;
  return data as CoachPlayerLink;
}
