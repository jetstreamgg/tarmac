import { UnauthorizedProviderError } from 'viem';
import { describe, expect, it } from 'vitest';
import { isUnauthorizedRequestError } from './isUnauthorizedRequestError';

describe('isUnauthorizedRequestError', () => {
  it('matches the 4100 code, at the top or nested in its causes', () => {
    expect(isUnauthorizedRequestError({ code: 4100 })).toBe(true);
    expect(isUnauthorizedRequestError({ code: -1, cause: { cause: { code: '4100' } } })).toBe(true);
  });

  it("matches viem's error for it", () => {
    expect(isUnauthorizedRequestError(new UnauthorizedProviderError(new Error('not authorized')))).toBe(true);
  });

  it('does not match a rejection, a revert or a non-error', () => {
    expect(isUnauthorizedRequestError({ code: 4001 })).toBe(false);
    expect(isUnauthorizedRequestError({ code: -32000, message: 'execution reverted' })).toBe(false);
    expect(isUnauthorizedRequestError(undefined)).toBe(false);
    expect(isUnauthorizedRequestError('4100')).toBe(false);
  });
});
