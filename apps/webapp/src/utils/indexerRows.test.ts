import { describe, expect, it } from 'vitest';
import { mapIndexerRows, safeBigInt } from './indexerRows';

describe('safeBigInt', () => {
  it('parses integer strings, numbers and bigints', () => {
    expect(safeBigInt('123')).toBe(123n);
    expect(safeBigInt('-5')).toBe(-5n);
    expect(safeBigInt(7)).toBe(7n);
    expect(safeBigInt(9n)).toBe(9n);
  });

  it('returns undefined instead of throwing on malformed input', () => {
    expect(safeBigInt(undefined)).toBeUndefined();
    expect(safeBigInt(null)).toBeUndefined();
    expect(safeBigInt('')).toBeUndefined();
    expect(safeBigInt('1.5')).toBeUndefined();
    expect(safeBigInt('abc')).toBeUndefined();
    expect(safeBigInt(1.5)).toBeUndefined();
    expect(safeBigInt({})).toBeUndefined();
  });
});

describe('mapIndexerRows', () => {
  it('maps rows and drops the ones the mapper rejects', () => {
    const rows = [{ v: '1' }, { v: 'bad' }, { v: '3' }];
    const out = mapIndexerRows<{ v: string }, bigint>(rows, r => safeBigInt(r.v));
    expect(out).toEqual([1n, 3n]);
  });

  it('treats a missing or non-array list as empty', () => {
    expect(mapIndexerRows(undefined, () => 1)).toEqual([]);
    expect(mapIndexerRows(null, () => 1)).toEqual([]);
    expect(mapIndexerRows({}, () => 1)).toEqual([]);
  });
});
