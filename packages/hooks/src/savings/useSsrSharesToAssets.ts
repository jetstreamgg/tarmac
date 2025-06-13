import { TokenBalance } from '../tokens/useTokenBalance';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { getTokenDecimals } from '../tokens/tokens.constants';
import { Token } from '../tokens/types';
import { useChainId } from 'wagmi';
import { useReadPsm3L2ConvertToAssetValue } from '../generated';

export const useSsrSharesToAssets = (sUsdsBalance: TokenBalance | undefined, returnToken: Token) => {
  const { data: assets } = useReadPsm3L2ConvertToAssetValue({
    args: [sUsdsBalance?.value || 0n]
  });

  // used for fetching the correct decimals for the origin token
  // assumes the origin token is on the chain the user is on
  const chainId = useChainId();

  const tokenDecimals = getTokenDecimals(returnToken, chainId);

  let truncatedAssets = assets;

  // If token decimals is less than 18, truncate the result
  if (tokenDecimals < 18 && assets) {
    const truncateBy = 18n - BigInt(tokenDecimals);
    truncatedAssets = assets / 10n ** truncateBy;
  }

  if (!sUsdsBalance || !truncatedAssets) {
    return {
      formatted: '0',
      value: 0n
    };
  }

  // Format the result
  const formattedAmount = formatBigInt(truncatedAssets, { unit: tokenDecimals });
  return {
    value: truncatedAssets,
    formatted: formattedAmount
  };
};
