import { mcdSpotAddress, mcdVatAddress, useReadMcdSpot, useReadMcdVat } from '../generated';
import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { Vault, VaultRaw } from './vault';
import { calculateVaultInfo, rawVaultInfo } from './calculateVaultInfo';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { TRUST_LEVELS } from '../constants';
import { stringToHex } from 'viem';
import { SupportedCollateralTypes } from './vaults.constants';
import { getIlkName } from './helpers';

// Get a user's vault
export function useVault(
  urn?: `0x${string}`,
  ilkNameParam?: SupportedCollateralTypes
): ReadHook & { data?: Vault; raw?: VaultRaw } {
  const chainId = useChainId();

  // MCD Vat
  // We get the collateral and debt from the MCD Vat contract

  const ilkName = ilkNameParam || getIlkName(chainId);
  const ilkHex = stringToHex(ilkName, { size: 32 });

  const mcdVatSource = {
    title: 'MCD_VAT Contract. (ilks, urns)',
    onChain: true,
    href: getEtherscanLink(chainId, mcdVatAddress[chainId as keyof typeof mcdVatAddress], 'address'),
    trustLevel: TRUST_LEVELS[0]
  };

  const {
    data: vatIlkData,
    isLoading: isLoadingVatIlk,
    error: errorVatIlk,
    refetch: refetchVatIlk
  } = useReadMcdVat({
    chainId: chainId as any,
    functionName: 'ilks',
    args: [ilkHex],
    scopeKey: `vat-ilk-${ilkName}`
  });

  const [, rate, spot, , dust] = vatIlkData || [];

  const {
    data: urnData,
    isLoading: isLoadingVatUrn,
    error: errorVatUrn,
    refetch: refetchVatUrn
  } = useReadMcdVat({
    chainId: chainId as any,
    functionName: 'urns',
    args: [ilkHex, urn!],
    scopeKey: `vat-urn-${ilkName}-${urn}`,
    query: { enabled: !!urn }
  });

  const [ink, art] = urnData || [];
  // MCD Spot
  // We get the par and mat from the MCD Spot contract

  const mcdSpotSource = {
    title: 'MCD_SPOT Contract. (par, ilks)',
    onChain: true,
    href: getEtherscanLink(chainId, mcdSpotAddress[chainId as keyof typeof mcdSpotAddress], 'address'),
    trustLevel: TRUST_LEVELS[0]
  };
  const {
    data: par,
    isLoading: isLoadingSpotPar,
    error: errorSpotPar,
    refetch: refetchSpotPar
  } = useReadMcdSpot({
    chainId: chainId as any,
    functionName: 'par',
    scopeKey: 'spot-par'
  });

  const {
    data: spotIlkData,
    isLoading: isLoadingSpotIlk,
    error: errorSpotIlk,
    refetch: refetchSpotIlk
  } = useReadMcdSpot({
    chainId: chainId as any,
    functionName: 'ilks',
    args: [ilkHex],
    scopeKey: `spot-ilks-${ilkName}`
  });

  const [, mat] = spotIlkData || [];

  // compute a isLoading, based on all the other isLoading, and error, based on all the other errors
  const isLoading = isLoadingVatIlk || isLoadingVatUrn || isLoadingSpotPar || isLoadingSpotIlk;

  // Once all the values are present we can compute the vault info
  const allLoaded = [spot, rate, ink, art, par, mat, dust].every(value => !!value || value === 0n);
  const vaultParams = {
    spot: spot as bigint,
    rate: rate as bigint,
    art: art as bigint,
    ink: ink as bigint,
    par: par as bigint,
    mat: mat as bigint,
    dust: dust as bigint
  };
  const data = allLoaded ? calculateVaultInfo(vaultParams) : undefined;
  const raw = allLoaded ? rawVaultInfo(vaultParams) : undefined;

  return {
    data: data ? { ...data, collateralType: ilkName } : undefined,
    raw,
    isLoading: !!isLoading,
    error: errorVatUrn || errorVatIlk || errorSpotPar || errorSpotIlk,
    mutate: () => {
      refetchVatUrn();
      refetchVatIlk();
      refetchSpotPar();
      refetchSpotIlk();
    },
    dataSources: [mcdVatSource, mcdSpotSource]
  };
}
