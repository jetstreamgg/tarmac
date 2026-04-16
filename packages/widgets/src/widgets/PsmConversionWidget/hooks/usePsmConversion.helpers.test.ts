import { describe, expect, it } from 'vitest';
import {
  getPsmConversionTokens,
  getPsmDecimalsForDirection,
  getPsmDirectionHalted,
  getPsmTargetAmount,
  getPsmExecutionAmounts,
  getPsmDisabledReason,
  getValidatedPsmExternalAmount
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

  it('disables L2 flow when liquidity is insufficient', () => {
    expect(
      getPsmDisabledReason({
        chainId: base.id,
        amount: 1_000_000n,
        mainnetGemAmt: 1_000_000n,
        hasSufficientLiquidity: false
      })
    ).toBe('insufficient_liquidity');
  });

  it('allows L2 flow when liquidity is sufficient', () => {
    expect(
      getPsmDisabledReason({
        chainId: base.id,
        amount: 1_000_000n,
        mainnetGemAmt: 1_000_000n,
        hasSufficientLiquidity: true
      })
    ).toBeUndefined();
  });

  it('disables mainnet USDS_TO_USDC when pocket liquidity is insufficient', () => {
    expect(
      getPsmDisabledReason({
        chainId: mainnet.id,
        amount: 1_000_000_000_000_000_000n,
        mainnetGemAmt: 1_000_000n,
        isLive: true,
        isDirectionHalted: false,
        hasNonZeroFee: false,
        hasSufficientLiquidity: false
      })
    ).toBe('insufficient_liquidity');
  });

  it('returns the correct source decimals for each direction', () => {
    expect(getPsmDecimalsForDirection('USDC_TO_USDS')).toBe(6);
    expect(getPsmDecimalsForDirection('USDS_TO_USDC')).toBe(18);
  });

  it('rejects deep-link amounts that parseUnits cannot parse for the active direction', () => {
    expect(getValidatedPsmExternalAmount('1e-7', 'USDC_TO_USDS')).toBeUndefined();
    expect(getValidatedPsmExternalAmount('0.0000001', 'USDC_TO_USDS')).toBeUndefined();
    expect(getValidatedPsmExternalAmount('0.0000001', 'USDS_TO_USDC')).toBe('0.0000001');
  });

  it('treats zero halted flags as unhalted even when fees are zero', () => {
    expect(
      getPsmDirectionHalted({
        direction: 'USDC_TO_USDS',
        feeWad: 0n,
        haltedValue: 0n
      })
    ).toBe(false);
  });

  it('decodes direction-specific halt flags for each conversion path', () => {
    expect(
      getPsmDirectionHalted({
        direction: 'USDC_TO_USDS',
        feeWad: 0n,
        haltedValue: 2n
      })
    ).toBe(true);
    expect(
      getPsmDirectionHalted({
        direction: 'USDS_TO_USDC',
        feeWad: 0n,
        haltedValue: 2n
      })
    ).toBe(false);
    expect(
      getPsmDirectionHalted({
        direction: 'USDS_TO_USDC',
        feeWad: 0n,
        haltedValue: 1n
      })
    ).toBe(true);
  });

  it('falls back to fee-based halt sentinels for lite-psm compatible wrappers', () => {
    const haltedFee = (1n << 256n) - 1n;

    expect(
      getPsmDirectionHalted({
        direction: 'USDC_TO_USDS',
        feeWad: haltedFee,
        haltedValue: haltedFee
      })
    ).toBe(true);
  });
});
