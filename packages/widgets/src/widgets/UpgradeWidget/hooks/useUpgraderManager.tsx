import { Token } from '@jetstreamgg/hooks';
import { useDaiToUsds, useMkrToSky, useUsdsToDai, useSkyToMkr } from '@jetstreamgg/hooks';
import { WriteHookParams } from '@jetstreamgg/hooks';

export function useUpgraderManager({
  enabled = true,
  ...params
}: WriteHookParams & {
  token: Token;
  amount: bigint;
}) {
  const daiUsds = useDaiToUsds({ ...params, enabled: enabled && params.token.symbol === 'DAI' });
  const usdsToDai = useUsdsToDai({ ...params, enabled: enabled && params.token.symbol === 'USDS' });
  const mkrSky = useMkrToSky({ ...params, enabled: enabled && params.token.symbol === 'MKR' });
  const skyToMkr = useSkyToMkr({ ...params, enabled: enabled && params.token.symbol === 'SKY' });

  if (params.token.symbol === 'DAI') {
    return daiUsds;
  } else if (params.token.symbol === 'USDS') {
    return usdsToDai;
  } else if (params.token.symbol === 'MKR') {
    return mkrSky;
  } else if (params.token.symbol === 'SKY') {
    return skyToMkr;
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
