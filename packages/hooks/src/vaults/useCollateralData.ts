import {
  useReadMcdVat,
  useReadMcdJug,
  useReadMcdSpot,
  mcdVatAddress,
  mcdJugAddress,
  mcdSpotAddress
} from '../generated';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { stringToHex } from 'viem';

import { TRUST_LEVELS } from '../constants';
import { ReadHook } from '../hooks';
import { calculateCollateralRiskParams } from './calculateCollateralRiskParams';
import { CollateralRiskParameters, VaultRaw } from './vault';
import { SupportedCollateralTypes } from './vaults.constants';
import { useChainId, useSimulateContract } from 'wagmi';
import { rawVaultInfo } from './calculateVaultInfo';
import { getIlkName } from './helpers';
import { mcdJugAbi } from '../generated';

// Get all the risk parameters of a collateral type by it's collateral type name
export function useCollateralData(
  ilkNameParam?: SupportedCollateralTypes
): ReadHook & { data?: CollateralRiskParameters; raw?: VaultRaw } {
  const chainId = useChainId();

  const ilkName = ilkNameParam || getIlkName(chainId);
  const ilkHex = stringToHex(ilkName, { size: 32 });

  // MCD Vat
  // We get the collateral and debt from the MCD Vat contract
  const mcdVatSource = {
    title: 'MCD_VAT Contract. (ilks)',
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
    scopeKey: `vat-ilk-${name}`
  });

  const [ilkArt, , spot, line, dust] = vatIlkData || [];

  // Mcd Jug
  // We get the duty from the MCD Jug contract

  const mcdJugDataSource = {
    title: 'MCD_JUG Contract. ilks',
    onChain: true,
    href: getEtherscanLink(chainId, mcdJugAddress[chainId as keyof typeof mcdJugAddress], 'address'),
    trustLevel: TRUST_LEVELS[0]
  };

  const {
    data: jugIlkData,
    isLoading: isLoadingJugIlk,
    error: errorJugIlk,
    refetch: refetchJugIlk
  } = useReadMcdJug({
    chainId: chainId as any,
    functionName: 'ilks',
    scopeKey: 'jug-ilks',
    args: [ilkHex]
  });

  const [duty] = jugIlkData || [];

  //simulate drip to get updated rate
  const {
    data: dripSimulation,
    error: dripError,
    isLoading: isLoadingDrip
  } = useSimulateContract({
    address: mcdJugAddress[chainId as keyof typeof mcdJugAddress],
    abi: mcdJugAbi,
    functionName: 'drip',
    args: [ilkHex],
    account: '0x0000000000000000000000000000000000000000'
  });

  const newRate = dripSimulation?.result;

  // Mcd Spot
  // We get the par from the MCD Spot contract
  const mcdSpotSource = {
    title: 'MCD_SPOT Contract. par',
    onChain: true,
    href: getEtherscanLink(chainId, mcdSpotAddress[chainId as keyof typeof mcdSpotAddress], 'address'),
    trustLevel: TRUST_LEVELS[0]
  };

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

  // compute a isLoading, based on all the other isLoading, and error, based on all the other errors
  const isLoading =
    isLoadingVatIlk || isLoadingSpotIlk || isLoadingJugIlk || isLoadingSpotPar || isLoadingDrip;

  // Once all the values are present we can compute the vault info
  const allLoaded = [spot, newRate, line, dust, ilkArt, mat, duty, par].every(
    value => !!value || value === 0n
  );
  const vaultParams = {
    spot: spot as bigint,
    rate: newRate as bigint,
    line: line as bigint,
    dust: dust as bigint,
    ilkArt: ilkArt as bigint,
    mat: mat as bigint,
    duty: duty as bigint,
    par: par as bigint
  };
  const data = allLoaded ? calculateCollateralRiskParams(vaultParams) : undefined;
  const raw = allLoaded ? rawVaultInfo(vaultParams) : undefined;

  return {
    data,
    raw,
    isLoading: !!isLoading,
    error: errorVatIlk || errorSpotIlk || errorJugIlk || errorSpotPar || dripError || null,
    mutate: () => {
      refetchVatIlk();
      refetchJugIlk();
      refetchSpotPar();
      refetchSpotIlk();
    },
    dataSources: [mcdVatSource, mcdJugDataSource, mcdSpotSource]
  };
}
