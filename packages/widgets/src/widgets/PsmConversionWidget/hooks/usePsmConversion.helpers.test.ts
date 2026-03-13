import { describe, expect, it } from 'vitest';
import {
  getPsmConversionTokens,
  getPsmTargetAmount,
  getPsmExecutionAmounts,
  getPsmDisabledReason
} from './usePsmConversion.helpers';
import { mainnet, base } from 'wagmi/chains';

describe('usePsmConversion helpers', () => {
  it('maps USDC to USDS amounts across decimals', () => {
    expect(getPsmTargetAmount('USDC_TO_USDS', 1230000n)).toBe(1230000000000000000n);
  });

  it('maps USDS to USDC amounts across decimals', () => {
    expect(getPsmTargetAmount('USDS_TO_USDC', 1230000000000000000n)).toBe(1230000n);
  });

  it('returns execution amounts for mainnet reverse flow', () => {
    expect(getPsmExecutionAmounts('USDS_TO_USDC', 5000000000000000000n)).toEqual({
      targetAmount: 5000000n,
      l2AmountIn: 5000000000000000000n,
      l2MinAmountOut: 5000000n,
      mainnetGemAmt: 5000000n,
      mainnetUsdsAmountInWad: 5000000000000000000n
    });
  });

  it('returns tokens for supported chains', () => {
    const { originToken, targetToken } = getPsmConversionTokens(mainnet.id, 'USDC_TO_USDS');
    expect(originToken?.symbol).toBe('USDC');
    expect(targetToken?.symbol).toBe('USDS');
  });

  it('disables non-zero fee mainnet flows', () => {
    expect(
      getPsmDisabledReason({
        chainId: mainnet.id,
        amount: 1_000_000n,
        mainnetGemAmt: 1_000_000n,
        isLive: true,
        isDirectionHalted: false,
        hasNonZeroFee: true,
        hasSufficientLiquidity: true
      })
    ).toBe('non_zero_fee');
  });

  it('does not disable nominal l2 flow', () => {
    expect(
      getPsmDisabledReason({
        chainId: base.id,
        amount: 1_000_000n,
        mainnetGemAmt: 1_000_000n
      })
    ).toBeUndefined();
  });
});
