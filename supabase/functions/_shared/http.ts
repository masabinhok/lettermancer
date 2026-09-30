// Shared helpers for Keycraft edge functions: CORS, JSON replies, and the signed-in user.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** The service-role client: bypasses row-level security. Only edge functions hold this key. */
export const admin = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

/** Resolve the caller from their access token, or null. */
export async function caller(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ?? null;
}

/** Keep a player's best score on a board. */
export async function submitBest(
  db: SupabaseClient,
  board: string,
  userId: string,
  score: number,
  detail: Record<string, unknown>,
  runId: number | null,
  practiceId: number | null = null,
): Promise<{ best: number; improved: boolean }> {
  const { data: cur } = await db
    .from('leaderboard')
    .select('score')
    .eq('board', board)
    .eq('user_id', userId)
    .maybeSingle();
  if (cur && Number(cur.score) >= score) return { best: Number(cur.score), improved: false };
  const { error } = await db.from('leaderboard').upsert({
    board,
    user_id: userId,
    score,
    detail,
    run_id: runId,
    practice_id: practiceId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { best: score, improved: true };
}

/** Where the player now stands on a board. */
export async function rankOn(db: SupabaseClient, board: string, userId: string): Promise<number | null> {
  const { data } = await db
    .from('leaderboard_named')
    .select('rank')
    .eq('board', board)
    .eq('user_id', userId)
    .maybeSingle();
  return data ? Number(data.rank) : null;
}
