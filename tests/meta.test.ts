import { describe, expect, it } from 'vitest';
import { applyUnlocks, defaultMeta } from '../src/engine/meta';

describe('unlocks', () => {
  it('unlocks each starter once', () => {
    const m = defaultMeta();
    expect(applyUnlocks(m, { act: 2, coins: 59 })).toEqual([]);
    expect(applyUnlocks(m, { act: 3 })).toEqual(['glassblower']);
    expect(applyUnlocks(m, { act: 3, coins: 60, flawlessElite: true })).toEqual(['cryomancer', 'tycoon']);
    expect(applyUnlocks(m, { act: 3, coins: 60, flawlessElite: true })).toEqual([]);
  });
});
