/**
 * The Supabase connection, loaded only when needed. Guests who never sign in or open a leaderboard
 * never download the client library. Builds without cloud settings play fully offline.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = !!(url && key);
export const functionsUrl = url ? `${url}/functions/v1` : '';

let loading: Promise<SupabaseClient | null> | null = null;

/** The Supabase client, downloaded and created on first use; null when the build has no cloud settings. */
export function loadSupabase(): Promise<SupabaseClient | null> {
  loading ??= cloudEnabled
    ? import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, key!))
    : Promise.resolve(null);
  return loading;
}

/** Is a sign-in saved on this device, or are we arriving back from a sign-in link? Then load at start. */
export function authPending(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {
    // no storage: nothing saved
  }
  return /[?#&](code|access_token|error_description)=/.test(location.href);
}
