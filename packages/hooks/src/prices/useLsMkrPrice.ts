import { useChainId } from 'wagmi';
import { PriceData } from './usePrices';
import { formatEther, stringToHex } from 'viem';
import { lsMkrAddress, mcdSpotAddress, mcdVatAddress, useReadMcdSpot, useReadMcdVat } from '../generated';
import { getEtherscanLink, math } from '@jetstreamgg/sky-utils';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { getIlkName } from '../vaults/helpers';

export const useLsMkrPrice = (): ReadHook & { data?: PriceData } => {
  const chainId = useChainId();
  const ilkName = getIlkName(chainId);
  const ilkHex = stringToHex(ilkName, { size: 32 });

  // MCD Vat
  const {
    data: vatIlkData,
    isLoading: isLoadingVatIlk,
    error: errorVatIlk,
    refetch: mutateVatIlk
  } = useReadMcdVat({
    chainId: chainId as any,
    functionName: 'ilks',
    args: [ilkHex],
    scopeKey: `vat-ilk-${ilkName}`
  });

  const [, , spot] = vatIlkData || [];

  const {
    data: par,
    isLoading: isLoadingSpotPar,
    error: errorSpotPar,
    refetch: mutateSpotPar
  } = useReadMcdSpot({
    chainId: chainId as any,
    functionName: 'par',
    scopeKey: 'spot-par'
  });

  const {
    data: spotIlkData,
    isLoading: isLoadingSpotIlk,
    error: errorSpotIlk,
    refetch: mutateSpotIlk
  } = useReadMcdSpot({
    chainId: chainId as any,
    functionName: 'ilks',
    args: [ilkHex],
    scopeKey: `spot-ilks-${ilkName}`
  });

  const [, mat] = spotIlkData || [];

  const delayedPrice = par && spot && mat ? math.delayedPrice(par, spot, mat) : undefined;

  return {
    data: delayedPrice
      ? {
          underlying_address: lsMkrAddress[chainId as keyof typeof lsMkrAddress],
          underlying_symbol: 'LSMKR',
          price: formatEther(delayedPrice),
          datetime: new Date().toISOString(),
          source: 'maker_osm'
        }
      : undefined,
    isLoading: isLoadingVatIlk || isLoadingSpotPar || isLoadingSpotIlk,
    error: errorVatIlk || errorSpotPar || errorSpotIlk,
    mutate: () => {
      mutateVatIlk();
      mutateSpotPar();
      mutateSpotIlk();
    },
    dataSources: [
      {
        title: 'McdVat contract',
        onChain: true,
        href: getEtherscanLink(chainId, mcdVatAddress[chainId as keyof typeof mcdVatAddress], 'address'),
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
      },
      {
        title: 'McdSpot contract',
        onChain: true,
        href: getEtherscanLink(chainId, mcdSpotAddress[chainId as keyof typeof mcdSpotAddress], 'address'),
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
      }
    ]
  };
};
