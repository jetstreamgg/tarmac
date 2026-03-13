import { TOKENS, type TokenForChain } from '@jetstreamgg/sky-hooks';
import { math, isL2ChainId } from '@jetstreamgg/sky-utils';

export type PsmConversionDirection = 'USDC_TO_USDS' | 'USDS_TO_USDC';

export type PsmConversionDisabledReason =
  | 'unsupported_chain'
  | 'amount_too_small'
  | 'psm_unavailable'
  | 'direction_halted'
  | 'non_zero_fee'
  | 'insufficient_liquidity';

export function getPsmConversionTokens(
  chainId: number,
  direction: PsmConversionDirection
): { originToken?: TokenForChain; targetToken?: TokenForChain } {
  const usdcAddress = TOKENS.usdc.address[chainId];
  const usdsAddress = TOKENS.usds.address[chainId];

  if (!usdcAddress || !usdsAddress) {
    return { originToken: undefined, targetToken: undefined };
  }

  const usdcToken: TokenForChain = {
    ...TOKENS.usdc,
    address: usdcAddress
  };
  const usdsToken: TokenForChain = {
    ...TOKENS.usds,
    address: usdsAddress
  };

  return direction === 'USDC_TO_USDS'
    ? { originToken: usdcToken, targetToken: usdsToken }
    : { originToken: usdsToken, targetToken: usdcToken };
}

export function getPsmTargetAmount(direction: PsmConversionDirection, amount: bigint): bigint {
  if (amount === 0n) return 0n;
  return direction === 'USDC_TO_USDS' ? math.convertUSDCtoWad(amount) : math.convertWadtoUSDC(amount);
}

export function getPsmExecutionAmounts(direction: PsmConversionDirection, amount: bigint) {
  const targetAmount = getPsmTargetAmount(direction, amount);

  return {
    targetAmount,
    l2AmountIn: amount,
    l2MinAmountOut: targetAmount,
    mainnetGemAmt: direction === 'USDC_TO_USDS' ? amount : targetAmount,
    mainnetUsdsAmountInWad: direction === 'USDS_TO_USDC' ? amount : targetAmount
  };
}

export function getPsmDisabledReason({
  chainId,
  amount,
  mainnetGemAmt,
  isLive,
  isDirectionHalted,
  hasNonZeroFee,
  hasSufficientLiquidity
}: {
  chainId: number;
  amount: bigint;
  mainnetGemAmt: bigint;
  isLive?: boolean;
  isDirectionHalted?: boolean;
  hasNonZeroFee?: boolean;
  hasSufficientLiquidity?: boolean;
}): PsmConversionDisabledReason | undefined {
  const tokens = getPsmConversionTokens(chainId, 'USDC_TO_USDS');
  if (!tokens.originToken || !tokens.targetToken) {
    return 'unsupported_chain';
  }

  if (amount > 0n && mainnetGemAmt === 0n) {
    return 'amount_too_small';
  }

  if (!isL2ChainId(chainId)) {
    if (isLive === false) {
      return 'psm_unavailable';
    }

    if (isDirectionHalted) {
      return 'direction_halted';
    }

    // Until exact fee-adjusted quoting is implemented in the widget,
    // disable execution when mainnet fees are non-zero.
    if (hasNonZeroFee) {
      return 'non_zero_fee';
    }

    if (hasSufficientLiquidity === false) {
      return 'insufficient_liquidity';
    }
  }

  return undefined;
}
