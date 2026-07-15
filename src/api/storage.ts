import { supabase } from '../lib/supabase';

const BUCKET = 'videos';

/**
 * Upload a video file to the private bucket under {ownerId}/{timestamp}-{name}.
 * ownerId must be the player_id folder (RLS enforces the caller may write there:
 * a player writes their own folder; a coach may write a linked player's folder).
 * Returns the storage path (store this in *_video_url with is_external=false).
 */
export async function uploadVideo(ownerId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${ownerId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Signed URL for a stored (private) video path. Expires in `seconds`. */
export async function getVideoUrl(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
