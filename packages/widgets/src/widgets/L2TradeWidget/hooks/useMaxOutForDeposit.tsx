import {
  TokenForChain,
  tokenForChainToToken,
  usePreviewSwapExactIn,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export const useMaxOutForDeposit = (
  originAmount: bigint,
  originToken?: TokenForChain,
  targetToken?: TokenForChain
) => {
  const chainId = useChainId();

  const { value } = usePreviewSwapExactIn(
    originAmount,
    originToken
      ? tokenForChainToToken(originToken, originToken?.address || ZERO_ADDRESS, chainId)
      : undefined,
    targetToken ? tokenForChainToToken(targetToken, targetToken?.address || ZERO_ADDRESS, chainId) : undefined
  );

  return { value };
};
