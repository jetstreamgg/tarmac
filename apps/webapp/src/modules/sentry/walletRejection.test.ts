import type { ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { filterWalletRejection } from './walletRejection';

const objectRejection = (serialized: unknown, keys = 'code, message'): ErrorEvent => ({
  type: undefined,
  exception: {
    values: [
      {
        type: 'UnhandledRejection',
        value: `Object captured as promise rejection with keys: ${keys}`
      }
    ]
  },
  extra: { __serialized__: serialized }
});

describe('filterWalletRejection', () => {
  it.each([4001, 4900, -32601, -32603, -32004])('drops plain-object rejections with code %i', code => {
    expect(filterWalletRejection(objectRejection({ code, message: 'whatever' }))).toBeNull();
  });

  it('drops an empty-object rejection', () => {
    expect(filterWalletRejection(objectRejection({}, '[object has no keys]'))).toBeNull();
  });

  it('drops a rejection with no serialized payload', () => {
    expect(filterWalletRejection(objectRejection(undefined, '[object has no keys]'))).toBeNull();
  });

  it('titles an unrecognized plain-object rejection from its code and message', () => {
    const event = filterWalletRejection(objectRejection({ code: 5000, message: 'User denied' }));

    expect(event?.exception?.values?.[0]).toMatchObject({
      type: 'UnhandledWalletRejection',
      value: 'User denied (5000)'
    });
  });

  it('titles a rejection that only carries a message', () => {
    const event = filterWalletRejection(objectRejection({ message: 'boom', stack: 'x' }, 'message, stack'));

    expect(event?.exception?.values?.[0]).toMatchObject({ type: 'UnhandledWalletRejection', value: 'boom' });
  });

  it('passes other events through untouched', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: 'TypeError', value: 'Failed to fetch' }] }
    };

    expect(filterWalletRejection(event)).toBe(event);
    expect(event.exception?.values?.[0]).toEqual({ type: 'TypeError', value: 'Failed to fetch' });
  });
});
