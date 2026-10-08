import { parseUnits, stringToHex } from 'viem';
import { getIlkName, usePrices, type Vault } from '@/hooks';
import { calculateVaultInfo } from '@/hooks/vaults/calculateVaultInfo';
import { useSimulatedDripRate } from '@/hooks/vaults/useSimulatedDripRate';
import { COLLATERAL_PRICE_SYMBOL } from '@/hooks/vaults/vaults.constants';
import { math } from '@/utils';
import { accruedRate, useStakeUrnVaults } from './useStakeUrnVaults';

/**
 * Vault figures for one positions-table row, computed from the list's own
 * snapshot: `useStakeUrnVaults` reads every urn's ink/art and the ilk
 * parameters (spot, rate, dust, par, mat) in one pass, so the risk cell and
 * the liquidation banner are decided together with the amounts. Risk uses the
 * dripped rate, as the details modal (`useVault`) does: the stored one lags and
 * understates risk on urns near the liquidation price.
 */
export function useStakeRowVault(position: { index: number; urnAddress?: `0x${string}` }): {
  data?: Vault;
  isLoading: boolean;
  error: Error | null;
} {
  const { vaultOf, isLoading, error } = useStakeRowVaultLookup();
  const data = vaultOf(position.index);
  return data ? { data, isLoading: false, error: null } : { data: undefined, isLoading, error };
}

/** Every row's vault figures from the same snapshot, for list-level work such as sorting. */
export function useStakeRowVaultLookup(): {
  vaultOf: (index: number) => Vault | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const ilkName = getIlkName(2);
  const { data: urnVaults, ilk, isLoading, error } = useStakeUrnVaults();
  // On a drip error fall back to the stored rate, as `useVault` does.
  const { data: drippedRate, isLoading: isLoadingDrip } = useSimulatedDripRate(
    stringToHex(ilkName, { size: 32 })
  );

  const { data: prices } = usePrices();
  const priceText = prices?.[COLLATERAL_PRICE_SYMBOL[ilkName]]?.price;
  const marketPrice = priceText ? parseUnits(priceText, 18) : undefined;

  const vaultOf = (index: number): Vault | undefined => {
    const urn = urnVaults?.find(entry => entry.index === index);
    if (!urn || !ilk || isLoadingDrip) return undefined;

    const rate = accruedRate(ilk.rate, drippedRate);
    const info = calculateVaultInfo({ ...ilk, rate, art: urn.art, ink: urn.skyLocked, marketPrice });
    const minCollateralForDust =
      info.dust && ilk.mat && info.delayedPrice
        ? math.minSafeCollateralAmount(info.dust, ilk.mat, info.delayedPrice)
        : undefined;
    return { ...info, collateralType: ilkName, minCollateralForDust };
  };

  return { vaultOf, isLoading: isLoading || isLoadingDrip, error };
}
