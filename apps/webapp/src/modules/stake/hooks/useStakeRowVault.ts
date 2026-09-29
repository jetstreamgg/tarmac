import { parseUnits } from 'viem';
import { getIlkName, usePrices, type Vault } from '@/hooks';
import { calculateVaultInfo } from '@/hooks/vaults/calculateVaultInfo';
import { COLLATERAL_PRICE_SYMBOL } from '@/hooks/vaults/vaults.constants';
import { math } from '@/utils';
import { useStakeUrnVaults } from './useStakeUrnVaults';

/**
 * Vault figures for one positions-table row, computed entirely from the
 * list's own snapshot: `useStakeUrnVaults` reads every urn's ink/art and the
 * ilk parameters (spot, rate, dust, par, mat) in one pass, so the risk cell
 * and the liquidation banner are decided in the same paint as the amounts —
 * no cold ilk reads or drip simulation arriving late and pushing the table
 * around. The rate is the Vat's stored one (the same the list's debt uses);
 * the details modal still shows the dripped figures via `useVault`.
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

  const { data: prices } = usePrices();
  const priceText = prices?.[COLLATERAL_PRICE_SYMBOL[ilkName]]?.price;
  const marketPrice = priceText ? parseUnits(priceText, 18) : undefined;

  const vaultOf = (index: number): Vault | undefined => {
    const urn = urnVaults?.find(entry => entry.index === index);
    if (!urn || !ilk) return undefined;

    const info = calculateVaultInfo({ ...ilk, art: urn.art, ink: urn.skyLocked, marketPrice });
    const minCollateralForDust =
      info.dust && ilk.mat && info.delayedPrice
        ? math.minSafeCollateralAmount(info.dust, ilk.mat, info.delayedPrice)
        : undefined;
    return { ...info, collateralType: ilkName, minCollateralForDust };
  };

  return { vaultOf, isLoading, error };
}
