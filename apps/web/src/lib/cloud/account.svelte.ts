/**
 * The signed-in account: authentication, progress sync, and submitting runs and practice
 * to be verified. Guests never need any of this — everything works locally.
 *
 * Sync rules (see `mergeMeta` in the engine):
 * - The first time a device signs in to an account, local guest progress is folded in and nothing
 *   earned offline is lost (currencies add up).
 * - After that, the device and the cloud merge collections and keep the newer copy's currencies.
 * - Signing in to a different account replaces local progress with that account's.
 */
import {
  defaultMeta,
  emptyStats,
  mergeMeta,
  mergeStatsFor,
  type Action,
  type Meta,
  type PracticeConfig,
  type PracticeInput,
  type RunConfig,
  type Stats,
} from '@keycraft/engine';
import type { User } from '@supabase/supabase-js';
import { profile, readStore, writeStore, type Settings } from '../stores/profile.svelte';
import { functionsUrl, supabase } from './client';

const LINK_KEY = 'keycraft.cloud.v1';
const OUTBOX_KEY = 'keycraft.outbox.v1';
const PUSH_DELAY_MS = 2000;

interface Link {
  userId: string | null;
  lastSync: string | null;
}

type Job = { kind: 'run'; body: { config: RunConfig; actions: Action[] } } | { kind: 'practice'; body: unknown };

export interface Standing {
  best: number;
  improved: boolean;
  rank: number | null;
}

export type SubmitResult =
  { ok: true; standings: Record<string, Standing>; score?: number } | { ok: false; reason: string; queued?: boolean };

class Account {
  user = $state.raw<User | null>(null);
  username = $state<string | null>(null);
  syncing = $state(false);
  lastSync = $state<string | null>(readStore<Link>(LINK_KEY, () => ({ userId: null, lastSync: null })).lastSync);
  error = $state<string | null>(null);
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  get enabled() {
    return supabase !== null;
  }

  /** Call once at app start. */
  start(): void {
    if (!supabase || this.started) return;
    this.started = true;
    supabase.auth.onAuthStateChange((event, session) => {
      const was = this.user?.id;
      this.user = session?.user ?? null;
      if (this.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && was !== this.user.id) {
        void this.onSignedIn();
      }
    });
    profile.onChange(() => this.schedulePush());
    addEventListener('online', () => void this.flushOutbox());
  }

  // ---------- sign in / out ----------

  async sendMagicLink(email: string): Promise<string | null> {
    if (!supabase) return 'Accounts are not set up on this build.';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/profile` },
    });
    return error?.message ?? null;
  }

  async signInWith(provider: 'github' | 'google'): Promise<string | null> {
    if (!supabase) return 'Accounts are not set up on this build.';
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/profile` },
    });
    return error?.message ?? null;
  }

  async signOut(): Promise<void> {
    await this.push();
    await supabase?.auth.signOut();
    this.user = null;
    this.username = null;
  }

  async setUsername(name: string): Promise<string | null> {
    if (!supabase || !this.user) return 'Sign in first.';
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return 'Use 3 to 20 letters, numbers or underscores.';
    const { error } = await supabase.from('profiles').update({ username: name }).eq('id', this.user.id);
    if (error) return error.code === '23505' ? 'That name is taken.' : error.message;
    this.username = name;
    return null;
  }

  // ---------- sync ----------

  private async onSignedIn(): Promise<void> {
    if (!supabase || !this.user) return;
    const { data: prof } = await supabase.from('profiles').select('username').eq('id', this.user.id).maybeSingle();
    this.username = prof?.username ?? null;
    await this.pull();
    await this.flushOutbox();
  }

  /** Fetch cloud progress and merge it with this device's. */
  async pull(): Promise<void> {
    if (!supabase || !this.user) return;
    this.syncing = true;
    this.error = null;
    try {
      const link = readStore<Link>(LINK_KEY, () => ({ userId: null, lastSync: null }));
      const { data, error } = await supabase
        .from('progress')
        .select('meta, stats, settings, updated_at')
        .eq('user_id', this.user.id)
        .maybeSingle();
      if (error) throw error;
      const local = { meta: profile.meta as Meta, stats: profile.stats };
      let meta: Meta;
      let stats: Stats;
      if (!data) {
        // A brand-new account: this device's progress becomes the account's.
        meta = local.meta;
        stats = local.stats;
      } else if (link.userId === null) {
        // First sign-in on this device: fold the guest's progress into the account.
        meta = mergeMeta(data.meta as Meta, local.meta, true);
        stats = mergeStatsFor(data.stats as Stats, local.stats, true);
      } else if (link.userId !== this.user.id) {
        // Another account's progress lives here: switch to this account's.
        meta = mergeMeta(defaultMeta(), data.meta as Meta);
        stats = (data.stats as Stats) ?? emptyStats();
      } else {
        meta = mergeMeta(local.meta, data.meta as Meta);
        stats = mergeStatsFor(local.stats, data.stats as Stats);
      }
      profile.replaceAll({ meta, stats });
      if (data?.settings && link.userId !== this.user.id) {
        Object.assign(profile.settings, data.settings as Partial<Settings>);
        profile.saveSettings();
      }
      writeStore(LINK_KEY, { userId: this.user.id, lastSync: link.lastSync });
      await this.push();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Sync failed.';
    } finally {
      this.syncing = false;
    }
  }

  private schedulePush(): void {
    if (!this.user) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.push(), PUSH_DELAY_MS);
  }

  /** Upload this device's progress. */
  async push(): Promise<void> {
    if (!supabase || !this.user) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('progress').upsert({
      user_id: this.user.id,
      meta: profile.meta,
      stats: profile.stats,
      settings: profile.settings,
      updated_at: now,
    });
    if (error) {
      this.error = error.message;
      return;
    }
    this.lastSync = now;
    writeStore(LINK_KEY, { userId: this.user.id, lastSync: now });
  }

  // ---------- verified submissions ----------

  private async invoke(name: string, body: unknown): Promise<Response> {
    const { data } = await supabase!.auth.getSession();
    return fetch(`${functionsUrl}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
  }

  private async send(job: Job): Promise<SubmitResult> {
    if (!supabase || !this.user) return { ok: false, reason: 'Sign in to post to the leaderboards.' };
    try {
      const res = await this.invoke(job.kind === 'run' ? 'verify-run' : 'verify-practice', job.body);
      const body = await res.json();
      if (res.ok && body.ok) {
        const standings =
          body.standings ?? (body.standing ? { [`practice:${body.result.testId}`]: body.standing } : {});
        return { ok: true, standings, score: body.score };
      }
      return { ok: false, reason: body.reason ?? body.error ?? 'The server refused it.' };
    } catch {
      this.enqueue(job);
      return { ok: false, reason: 'You’re offline. It will be sent when you reconnect.', queued: true };
    }
  }

  submitRun(config: RunConfig, actions: Action[]): Promise<SubmitResult> {
    return this.send({ kind: 'run', body: { config, actions } });
  }

  submitPractice(config: PracticeConfig, inputs: PracticeInput[], trial: string | null): Promise<SubmitResult> {
    return this.send({ kind: 'practice', body: { config, inputs, trial } });
  }

  private enqueue(job: Job): void {
    const box = readArray<Job>(OUTBOX_KEY);
    writeStore(OUTBOX_KEY, [...box, job].slice(-20));
  }

  async flushOutbox(): Promise<void> {
    if (!this.user) return;
    const box = readArray<Job>(OUTBOX_KEY);
    if (!box.length) return;
    writeStore(OUTBOX_KEY, []);
    for (const job of box) await this.send(job);
  }

  // ---------- your data ----------

  /** Everything we hold about you, as one JSON document. */
  async exportData(): Promise<Blob> {
    const out: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      local: { meta: profile.meta, stats: profile.stats, settings: profile.settings, runs: profile.analytics },
    };
    if (supabase && this.user) {
      const [prog, runs, practice] = await Promise.all([
        supabase.from('progress').select('*').eq('user_id', this.user.id).maybeSingle(),
        supabase.from('runs').select('*').eq('user_id', this.user.id),
        supabase.from('practice_results').select('*').eq('user_id', this.user.id),
      ]);
      out.cloud = {
        account: { id: this.user.id, email: this.user.email, username: this.username },
        progress: prog.data,
        runs: runs.data,
        practice: practice.data,
      };
    }
    return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  }

  /** Permanently delete the account and its cloud data. Local progress on this device stays. */
  async deleteAccount(): Promise<string | null> {
    if (!supabase || !this.user) return 'Sign in first.';
    const res = await this.invoke('delete-account', {});
    if (!res.ok) return (await res.json()).error ?? 'Could not delete the account.';
    writeStore(LINK_KEY, { userId: null, lastSync: null });
    await supabase.auth.signOut();
    this.user = null;
    this.username = null;
    return null;
  }
}

function readArray<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const account = new Account();
