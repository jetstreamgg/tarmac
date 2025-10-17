import { formatUnits, parseUnits, stringToHex } from 'viem';
import { mcdSpotAddress, mcdVatAddress, useReadMcdSpot, useReadMcdVat } from '../generated';
import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { Vault, VaultRaw } from './vault';
import { calculateVaultInfo } from './calculateVaultInfo';
import { getEtherscanLink, math } from '@jetstreamgg/sky-utils';
import { TRUST_LEVELS } from '../constants';
import { COLLATERAL_PRICE_SYMBOL, SupportedCollateralTypes } from './vaults.constants';
import { getIlkName } from './helpers';
import { usePrices } from '../prices/usePrices';

export function useSimulatedVault(
  collateralAmount: bigint,
  desiredDebtAmount: bigint,
  existingDebtAmount: bigint,
  ilkNameParam?: SupportedCollateralTypes
): ReadHook & { data?: Vault; raw?: VaultRaw } {
  const chainId = useChainId();
  const isPayingDebt = existingDebtAmount > desiredDebtAmount;

  const ilkName = ilkNameParam || getIlkName(1);
  const ilkHex = stringToHex(ilkName, { size: 32 });

  // Fetch market price for accurate liquidation risk calculations
  const { data: prices } = usePrices();
  const collateralPriceSymbol = COLLATERAL_PRICE_SYMBOL[ilkName];
  const marketPrice =
    collateralPriceSymbol && prices?.[collateralPriceSymbol]?.price
      ? parseUnits(prices[collateralPriceSymbol].price, 18)
      : undefined;

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

  const [, rate, spot, , dust] = vatIlkData || [];

  // MCD Spot
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

  const isLoading = isLoadingVatIlk || isLoadingSpotPar || isLoadingSpotIlk;
  const error = errorVatIlk || errorSpotPar || errorSpotIlk;

  // Once all the values are present we can compute the vault info
  const allLoaded = [spot, rate, par, mat, dust].every(value => !!value || value === 0n);
  const existingArt = rate ? math.artValue(existingDebtAmount, rate) : 0n;
  const desiredArt = rate ? math.artValue(desiredDebtAmount, rate) : 0n;

  const vaultParams = {
    spot: spot as bigint,
    rate: rate as bigint,
    art: existingArt,
    ink: collateralAmount,
    par: par as bigint,
    mat: mat as bigint,
    dust: dust as bigint,
    marketPrice
  };
  const data = allLoaded ? calculateVaultInfo(vaultParams) : undefined;
  const dataAtMaxBorrow = allLoaded ? calculateVaultInfo({ ...vaultParams, art: desiredArt }) : undefined;

  const minCollateralForDust =
    dataAtMaxBorrow?.dust && mat && dataAtMaxBorrow?.delayedPrice
      ? math.minSafeCollateralAmount(dataAtMaxBorrow.dust, mat, dataAtMaxBorrow.delayedPrice)
      : undefined;

  const insufficientCollateral =
    data?.maxSafeBorrowableAmount &&
    // Subtract the existingDebtAmount here because the maxSafeBorrowable is already accounting for the existing debt
    desiredDebtAmount - existingDebtAmount > data.maxSafeBorrowableAmount;

  const vaultError =
    error || insufficientCollateral
      ? new Error('Insufficient collateral')
      : data?.dust && desiredDebtAmount < data.dust && desiredDebtAmount !== 0n
        ? new Error(
            isPayingDebt
              ? `Debt must be payed off entirely, or left with a minimum of ${formatUnits(data.dust, 18)}`
              : `Minimum borrow amount is ${formatUnits(data.dust, 18)}`
          )
        : null;

  return {
    data: data
      ? {
          ...data,
          debtValue: desiredDebtAmount,
          collateralType: ilkName,
          collateralizationRatio: dataAtMaxBorrow?.collateralizationRatio,
          dust: dataAtMaxBorrow?.dust,
          delayedPrice: dataAtMaxBorrow?.delayedPrice,
          liquidationPrice: dataAtMaxBorrow?.liquidationPrice,
          liquidationProximityPercentage: dataAtMaxBorrow?.liquidationProximityPercentage,
          liquidationRatio: mat,
          riskLevel: dataAtMaxBorrow?.riskLevel,
          minCollateralForDust
        }
      : undefined,
    isLoading,
    error: vaultError,
    mutate: () => {
      mutateVatIlk();
      mutateSpotPar();
      mutateSpotIlk();
    },
    dataSources: [
      {
        title: 'MCD_VAT Contract. (ilks)',
        onChain: true,
        href: getEtherscanLink(chainId, mcdVatAddress[chainId as keyof typeof mcdVatAddress], 'address'),
        trustLevel: TRUST_LEVELS[0]
      },
      {
        title: 'MCD_SPOT Contract. (par, ilks)',
        onChain: true,
        href: getEtherscanLink(chainId, mcdSpotAddress[chainId as keyof typeof mcdSpotAddress], 'address'),
        trustLevel: TRUST_LEVELS[0]
      }
    ]
  };
}
