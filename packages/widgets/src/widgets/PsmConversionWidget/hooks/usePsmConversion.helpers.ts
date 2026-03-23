import { TOKENS, type TokenForChain } from '@jetstreamgg/sky-hooks';
import { math, isL2ChainId } from '@jetstreamgg/sky-utils';
import { parseUnits } from 'viem';

export type PsmConversionDirection = 'USDC_TO_USDS' | 'USDS_TO_USDC';

export type PsmConversionDisabledReason =
  | 'unsupported_chain'
  | 'amount_too_small'
  | 'psm_unavailable'
  | 'direction_halted'
  | 'non_zero_fee'
  | 'insufficient_liquidity';

const BUY_GEM_HALTED = 1n;
const SELL_GEM_HALTED = 2n;
const KNOWN_DIRECTION_HALT_FLAGS = BUY_GEM_HALTED | SELL_GEM_HALTED;
const DECIMAL_AMOUNT_PATTERN = /^(?:\d+\.?\d*|\.\d+)$/;

export function getPsmDecimalsForDirection(direction: PsmConversionDirection) {
  return direction === 'USDC_TO_USDS' ? 6 : 18;
}

export function getValidatedPsmExternalAmount(
  amount: string | undefined,
  direction: PsmConversionDirection
): string | undefined {
  if (amount === undefined || amount === '') {
    return amount;
  }

  if (!DECIMAL_AMOUNT_PATTERN.test(amount)) {
    return undefined;
  }

  const fractionalDigits = amount.split('.')[1]?.length ?? 0;
  if (fractionalDigits > getPsmDecimalsForDirection(direction)) {
    return undefined;
  }

  try {
    parseUnits(amount, getPsmDecimalsForDirection(direction));
    return amount;
  } catch {
    return undefined;
  }
}

export function getPsmDirectionHalted({
  direction,
  feeWad,
  haltedValue
}: {
  direction: PsmConversionDirection;
  feeWad?: bigint;
  haltedValue?: bigint;
}) {
  if (haltedValue === undefined) {
    return false;
  }

  if (haltedValue >= 0n && haltedValue <= KNOWN_DIRECTION_HALT_FLAGS) {
    const directionFlag = direction === 'USDC_TO_USDS' ? SELL_GEM_HALTED : BUY_GEM_HALTED;
    return (haltedValue & directionFlag) === directionFlag;
  }

  return feeWad !== undefined && haltedValue === feeWad;
}

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
