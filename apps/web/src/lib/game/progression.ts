/**
 * Turns meta progression into the plain numbers a run starts with.
 */
import { NO_BONUSES, type Meta, type RunBonuses } from '@keycraft/engine';

export function runBonuses(_meta: Meta): RunBonuses {
  return { ...NO_BONUSES };
}
