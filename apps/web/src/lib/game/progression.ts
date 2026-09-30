/**
 * Turns meta progression into the plain numbers a run starts with.
 */
import { runBonusesFor, type Meta, type RunBonuses } from '@keycraft/engine';

export function runBonuses(meta: Meta): RunBonuses {
  return runBonusesFor(meta);
}
