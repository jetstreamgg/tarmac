import { formatBigInt } from '@jetstreamgg/utils';
import { Token } from '../tokens/types';
import { getTokenDecimals } from '../tokens/tokens.constants';
import { useChainId } from 'wagmi';
import { useReadPsm3L2ConvertToShares } from '../generated';

export const useSsrAssetsToShares = (amount: bigint | undefined, originToken: Token) => {
  const { data: shares } = useReadPsm3L2ConvertToShares({
    args: [amount || 0n]
  });

  // used for fetching the correct decimals for the origin token
  // assumes the origin token is on the chain the user is on
  const chainId = useChainId();

  if (!amount || !shares) {
    return {
      formatted: '0',
      value: 0n
    };
  }

  // use the correct decimals for the origin token
  const tokenDecimals = getTokenDecimals(originToken, chainId);
  const scaledShares = shares * 10n ** BigInt(18 - tokenDecimals);

  // Format the result
  const formattedAmount = formatBigInt(scaledShares);

  return {
    value: scaledShares,
    formatted: formattedAmount
  };
};
