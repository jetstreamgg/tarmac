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
  const ilkName = getIlkName(2);
  const { data: urnVaults, ilk, isLoading, error } = useStakeUrnVaults();
  const urn = urnVaults?.find(entry => entry.index === position.index);

  const { data: prices } = usePrices();
  const priceText = prices?.[COLLATERAL_PRICE_SYMBOL[ilkName]]?.price;
  const marketPrice = priceText ? parseUnits(priceText, 18) : undefined;

  if (!urn || !ilk) return { data: undefined, isLoading, error };

  const info = calculateVaultInfo({ ...ilk, art: urn.art, ink: urn.skyLocked, marketPrice });
  const minCollateralForDust =
    info.dust && ilk.mat && info.delayedPrice
      ? math.minSafeCollateralAmount(info.dust, ilk.mat, info.delayedPrice)
      : undefined;

  return { data: { ...info, collateralType: ilkName, minCollateralForDust }, isLoading: false, error: null };
}
