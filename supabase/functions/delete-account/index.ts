// Deletes the caller's account. Every table cascades from auth.users, so all their data goes with it.
import { admin, caller, cors, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await caller(req);
  if (!user) return json({ error: 'Sign in first.' }, 401);
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
