/**
 * The game engine, for tests that need to build a run (for example to load a save at a shop).
 * Playwright can't import the engine's JSON word list directly, so bundle it once with esbuild.
 */
import { buildSync } from 'esbuild';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

type Engine = typeof import('../packages/engine/src/index');
let engine: Promise<Engine> | null = null;

export function loadEngine(): Promise<Engine> {
  if (!engine) {
    const out = join(tmpdir(), `lettermancer-engine-${process.pid}.mjs`);
    buildSync({
      entryPoints: ['packages/engine/src/index.ts'],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      outfile: out,
      logLevel: 'error',
    });
    engine = import(pathToFileURL(out).href) as Promise<Engine>;
  }
  return engine;
}
