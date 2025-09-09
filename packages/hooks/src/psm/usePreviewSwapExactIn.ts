import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Token } from '../tokens/types';
import { getTokenDecimals } from '../tokens/tokens.constants';
import { useChainId } from 'wagmi';
import { useReadPsm3L2PreviewSwapExactIn } from '../generated';
import { ZERO_ADDRESS } from '../index';

export const usePreviewSwapExactIn = (
  amount: bigint | undefined,
  inToken: Token | undefined,
  outToken: Token | undefined,
  chainIdParam?: number
) => {
  const currentChainId = useChainId();
  const chainId = chainIdParam || currentChainId;
  const { data: amountOut } = useReadPsm3L2PreviewSwapExactIn({
    args: [
      inToken?.address[chainId] || ZERO_ADDRESS,
      outToken?.address[chainId] || ZERO_ADDRESS,
      amount || 0n
    ],
    chainId: chainId as 8453 | 42161
  });

  if (!amount || !amountOut || !inToken || !outToken) {
    return {
      formatted: '0',
      value: 0n
    };
  }
  // use the correct decimals for the out token
  const tokenDecimals = getTokenDecimals(outToken, chainId);

  // Format the result
  const formattedAmount = formatBigInt(amountOut, { unit: tokenDecimals });

  return {
    value: amountOut,
    formatted: formattedAmount
  };
};
