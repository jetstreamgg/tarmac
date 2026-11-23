import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { encodeErrorResult } from 'viem';
import { pendlePrepareErrorMessage } from './prepareErrorMessage';

beforeAll(() => {
  i18n.load('en', {});
  i18n.activate('en');
});

const rpcRevert = (reason: string) =>
  Object.assign(new Error('execution reverted'), {
    data: encodeErrorResult({
      abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
      errorName: 'Error',
      args: [reason]
    })
  });

describe('pendlePrepareErrorMessage', () => {
  it('keeps the slippage copy, with the flow hint when given', () => {
    expect(pendlePrepareErrorMessage(new Error('execution reverted: INSUFFICIENT_TOKEN_OUT'))).toMatch(
      /slippage tolerance/
    );
    expect(pendlePrepareErrorMessage(new Error('Slippage: too high'), 'hint')).toBe('hint');
  });

  it('shows any other revert verbatim instead of the generic line (APP-663)', () => {
    expect(pendlePrepareErrorMessage(rpcRevert('Foo/bar'))).toBe(
      'The transaction would fail with "Foo/bar".'
    );
  });

  it('keeps the generic line for an error with no revert', () => {
    expect(pendlePrepareErrorMessage(new Error('HTTP request failed'))).toBe(
      'Unable to prepare transaction. Please try again or adjust your inputs.'
    );
    expect(pendlePrepareErrorMessage(undefined)).toBeUndefined();
  });
});
