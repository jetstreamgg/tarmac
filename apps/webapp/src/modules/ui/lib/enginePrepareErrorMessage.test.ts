import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { encodeErrorResult } from 'viem';
import { enginePrepareErrorMessage } from './enginePrepareErrorMessage';

beforeAll(() => {
  i18n.load('en', {});
  i18n.activate('en');
});

const revert = (reason: string) =>
  Object.assign(new Error('execution reverted'), {
    data: encodeErrorResult({
      abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
      errorName: 'Error',
      args: [reason]
    })
  });

describe('enginePrepareErrorMessage', () => {
  it('says nothing once prepared, or without an error', () => {
    expect(enginePrepareErrorMessage(true, revert('Vat/dust'))).toBeUndefined();
    expect(enginePrepareErrorMessage(false, null)).toBeUndefined();
  });

  it('reads a contract revert as its reason', () => {
    expect(enginePrepareErrorMessage(false, revert('LockstakeEngine/urn-unsafe'))).toMatch(
      /below the required collateralization ratio/
    );
  });

  it('keeps the generic retry line for anything that is not a revert', () => {
    expect(enginePrepareErrorMessage(false, new Error('HTTP request failed'))).toBe(
      'Something went wrong preparing the transaction. Please try again.'
    );
  });
});
