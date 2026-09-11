import { describe, it, expect } from 'vitest';
import { getValidatedState } from './utils';

describe('getValidatedState amount validation', () => {
  it.each(['100', '0.5', '.5', '5.', '0', ''])('accepts plain decimal amount %j', amount => {
    expect(getValidatedState({ amount })).toEqual({ amount });
  });

  it.each(['0x10', '1e999', 'Infinity', ' 16 ', '1,5', '-1', 'abc'])(
    'rejects non-decimal amount %j',
    amount => {
      expect(getValidatedState({ amount })).toBeUndefined();
    }
  );
});
