import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Token } from '../tokens/types';
import { getTokenDecimals } from '../tokens/tokens.constants';
import { useChainId } from 'wagmi';
import { useReadPsm3L2PreviewSwapExactOut } from '../generated';
import { ZERO_ADDRESS } from '../index';

export const usePreviewSwapExactOut = (
  amount: bigint | undefined,
  inToken: Token | undefined,
  outToken: Token | undefined
) => {
  const chainId = useChainId();
  const { data: amountIn } = useReadPsm3L2PreviewSwapExactOut({
    args: [
      inToken?.address[chainId] || ZERO_ADDRESS,
      outToken?.address[chainId] || ZERO_ADDRESS,
      amount || 0n
    ]
  });

  if (!amount || !amountIn || !inToken || !outToken) {
    return {
      formatted: '0',
      value: 0n
    };
  }
  // use the correct decimals for the in token
  const tokenDecimals = inToken ? getTokenDecimals(inToken, chainId) : 18;

  // Format the result
  const formattedAmount = formatBigInt(amountIn, { unit: tokenDecimals });

  return {
    value: amountIn,
    formatted: formattedAmount
  };
};
