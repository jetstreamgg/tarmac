import { beforeEach, describe, expect, it } from 'vitest';
import { recallStakePositionCount, rememberStakePositionCount } from './positionCountMemory';

const ADDRESS = '0xAbC0000000000000000000000000000000000001';

describe('positionCountMemory', () => {
  beforeEach(() => localStorage.clear());

  it('is undefined before the list has ever loaded, or without an address', () => {
    expect(recallStakePositionCount(1, ADDRESS)).toBeUndefined();
    expect(recallStakePositionCount(1, undefined)).toBeUndefined();
  });

  it('recalls the count per chain and wallet, case-insensitively', () => {
    rememberStakePositionCount(1, ADDRESS, 2);
    expect(recallStakePositionCount(1, ADDRESS.toLowerCase())).toBe(2);
    expect(recallStakePositionCount(10, ADDRESS)).toBeUndefined();
  });

  it('ignores a corrupt or zero value', () => {
    localStorage.setItem(`stake:positionCount:v1:1:${ADDRESS.toLowerCase()}`, 'nope');
    expect(recallStakePositionCount(1, ADDRESS)).toBeUndefined();
    rememberStakePositionCount(1, ADDRESS, 0);
    expect(recallStakePositionCount(1, ADDRESS)).toBeUndefined();
  });
});
