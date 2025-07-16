import {
  TokenForChain,
  tokenForChainToToken,
  usePreviewSwapExactOut,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export const useMaxInForWithdraw = (
  targetAmount: bigint,
  originToken?: TokenForChain,
  targetToken?: TokenForChain
) => {
  const chainId = useChainId();

  //used to calculate regular withdraw maxIn amount
  const { value } = usePreviewSwapExactOut(
    targetAmount,
    originToken
      ? tokenForChainToToken(originToken, originToken?.address || ZERO_ADDRESS, chainId)
      : undefined,
    targetToken ? tokenForChainToToken(targetToken, targetToken?.address || ZERO_ADDRESS, chainId) : undefined
  );

  return { value };
};
