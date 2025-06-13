import { Token } from '@jetstreamgg/sky-hooks';
import { useDaiUsdsApprove, useMkrSkyApprove } from '@jetstreamgg/sky-hooks';
import { WriteHookParams } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export function useApproveManager({
  amount,
  token,
  ...params
}: WriteHookParams & {
  amount: bigint;
  token: Token;
}) {
  const chainId = useChainId();
  const isDaiUsds = token.symbol === 'DAI' || token.symbol === 'USDS';
  const isMkrSky = token.symbol === 'MKR' || token.symbol === 'SKY';

  const approveParams = { ...params, tokenAddress: token.address[chainId], amount };

  const daiUsdsRes = useDaiUsdsApprove({
    ...approveParams,
    enabled: isDaiUsds
  });
  const mkrSkyRes = useMkrSkyApprove({
    ...approveParams,
    enabled: isMkrSky
  });

  if (isDaiUsds) {
    return daiUsdsRes;
  }
  if (isMkrSky) {
    return mkrSkyRes;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return {
    execute: () => {},
    data: null,
    isLoading: false,
    error: null,
    retryPrepare: () => {},
    prepareError: null,
    prepared: false
  };
}
