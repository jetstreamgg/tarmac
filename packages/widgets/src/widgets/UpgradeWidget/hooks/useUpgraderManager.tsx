import { Token } from '@jetstreamgg/sky-hooks';
import { useDaiToUsds, useMkrToSky, useUsdsToDai } from '@jetstreamgg/sky-hooks';
import { WriteHookParams } from '@jetstreamgg/sky-hooks';

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

  if (params.token.symbol === 'DAI') {
    return daiUsds;
  } else if (params.token.symbol === 'USDS') {
    return usdsToDai;
  } else if (params.token.symbol === 'MKR') {
    return mkrSky;
  }

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
