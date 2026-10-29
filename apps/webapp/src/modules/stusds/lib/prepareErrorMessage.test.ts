import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { encodeErrorResult } from 'viem';
import { stUsdsPrepareErrorMessage } from './prepareErrorMessage';

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

describe('stUsdsPrepareErrorMessage', () => {
  it('keeps its liquidity copy for the module running short', () => {
    expect(
      stUsdsPrepareErrorMessage(new Error('execution reverted: StUsds/insufficient-unused-funds'))
    ).toMatch(/does not have enough available USDS/);
  });

  it('reads any other revert through the registry (APP-663)', () => {
    expect(stUsdsPrepareErrorMessage(rpcRevert('StUsds/mint-over-supply-cap'))).toBe(
      'stUSDS has reached its deposit cap. Try a smaller amount or try again later.'
    );
  });

  it("reads Curve slippage as the registry's copy", () => {
    expect(stUsdsPrepareErrorMessage(rpcRevert('Exchange resulted in fewer coins than expected'))).toMatch(
      /price moved before your swap went through/
    );
  });

  it('keeps the generic line for an error with no revert', () => {
    expect(stUsdsPrepareErrorMessage(new Error('HTTP request failed'))).toBe(
      'An error occurred while preparing the transaction'
    );
    expect(stUsdsPrepareErrorMessage(null)).toBeUndefined();
  });
});
