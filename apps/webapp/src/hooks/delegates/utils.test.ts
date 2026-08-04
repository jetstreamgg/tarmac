import { describe, expect, it } from 'vitest';
import { buildDelegateSearchCondition, findDelegateNameMatches } from './utils';

const A = '0xaaaa000000000000000000000000000000000001';
const B = '0xbbbb000000000000000000000000000000000002';

describe('findDelegateNameMatches', () => {
  const mapping = {
    [A]: { name: 'Cloaky' },
    [B]: { name: 'BLUE' },
    '0xcccc000000000000000000000000000000000003': { name: undefined }
  };

  it('matches names case-insensitively on substrings', () => {
    expect(findDelegateNameMatches(mapping, 'cloak')).toEqual([A]);
    expect(findDelegateNameMatches(mapping, 'blue')).toEqual([B]);
  });

  it('returns undefined without a search term, mapping, or any match', () => {
    expect(findDelegateNameMatches(mapping, undefined)).toBeUndefined();
    expect(findDelegateNameMatches(mapping, '')).toBeUndefined();
    expect(findDelegateNameMatches(undefined, 'cloak')).toBeUndefined();
    expect(findDelegateNameMatches(mapping, 'nobody')).toBeUndefined();
  });
});

describe('buildDelegateSearchCondition', () => {
  it('returns undefined without a search term', () => {
    expect(buildDelegateSearchCondition(undefined, [A])).toBeUndefined();
  });

  it('keeps the plain address term when no names matched', () => {
    expect(buildDelegateSearchCondition('cloak', undefined)).toBe('{ address: { _ilike: "%cloak%" } }');
    expect(buildDelegateSearchCondition('cloak', [])).toBe('{ address: { _ilike: "%cloak%" } }');
  });

  it('ORs the address term with one _ilike per name-matched address', () => {
    expect(buildDelegateSearchCondition('cloak', [A, B])).toBe(
      `{ _or: [{ address: { _ilike: "%cloak%" } }, { address: { _ilike: "${A}" } }, { address: { _ilike: "${B}" } }] }`
    );
  });
});
