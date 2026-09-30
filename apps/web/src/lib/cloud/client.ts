/**
 * The Supabase client, or null when the app is built without cloud settings (fully offline play).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const cloudEnabled = supabase !== null;
export const functionsUrl = url ? `${url}/functions/v1` : '';
