import { describe, expect, it } from 'vitest';
import { isUserRejectedRequestError } from './isUserRejectedRequestError';

describe('isUserRejectedRequestError', () => {
  it('matches known wallet rejection codes', () => {
    expect(isUserRejectedRequestError({ code: 4001 })).toBe(true);
    expect(isUserRejectedRequestError({ cause: { code: 'ACTION_REJECTED' } })).toBe(true);
  });

  it('matches common wallet rejection names and messages', () => {
    expect(isUserRejectedRequestError({ name: 'UserRejectedRequestError' })).toBe(true);
    expect(isUserRejectedRequestError({ message: 'The user rejected the request.' })).toBe(true);
  });

  it('does not match unrelated wallet errors', () => {
    expect(isUserRejectedRequestError({ code: -32000, message: 'execution reverted' })).toBe(false);
  });
});
