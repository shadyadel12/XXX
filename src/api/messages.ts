import { supabase } from '../lib/supabase';
import type { Message } from '../types/database.types';

/** All messages for a player (general + exercise-scoped), newest first. */
export async function listMessagesForPlayer(playerId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Messages attached to a specific exercise. */
export async function listMessagesForExercise(exerciseId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface MessageInput {
  coach_id: string;
  player_id: string;
  exercise_id: string | null; // null = general
  body: string;
}

export async function sendMessage(input: MessageInput): Promise<Message> {
  const { data, error } = await supabase.from('messages').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) throw error;
}
