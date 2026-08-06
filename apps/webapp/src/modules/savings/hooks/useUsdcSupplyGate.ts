import { useUsdsPsmWrapperHalted, useUsdsPsmWrapperLive, useUsdsPsmWrapperTin } from '@/hooks';
import { getPsmDirectionHalted } from '@/modules/convert/hooks/usePsmConversion.helpers';

/** Why a mainnet USDC supply can't go out right now. */
export type UsdcSupplyBlockedReason = 'psm_unavailable' | 'direction_halted' | 'non_zero_fee';

export type UsdcSupplyGate = {
  /** Set when the PSM can't take USDC right now; the supply gate blocks on it. */
  blockedReason?: UsdcSupplyBlockedReason;
  /** False until every PSM read has answered — the gate holds the confirm until then. */
  ready: boolean;
};

/**
 * Can a mainnet USDC supply route through the PSM right now?
 *
 * The USDC → USDS leg is `sellGem` on the USDS PSM wrapper, so it inherits the
 * wrapper's three switches — the same ones the Convert surface honours (and via
 * the same halt-flag helper, so both read the module identically):
 *  - `live` — the wrapper is cased off entirely
 *  - `HALTED` — the sell direction specifically is frozen
 *  - `tin` — a nonzero fee means `sellGem` returns *less* USDS than the widened
 *    wad the deposit spends, so the flow would strand a swap and then revert on
 *    the deposit. Convert blocks on a nonzero fee for the same reason; until
 *    fee-adjusted quoting exists, so does this.
 *
 * L2 never reaches here: the wrapper has no address off mainnet (the reads stay
 * disabled) and L2 supply routes through the PSM3 `swapExactIn` engine instead.
 */
export function useUsdcSupplyGate(): UsdcSupplyGate {
  const { data: live } = useUsdsPsmWrapperLive();
  const { data: tin } = useUsdsPsmWrapperTin();
  const { data: haltedValue } = useUsdsPsmWrapperHalted();

  const ready = live !== undefined && tin !== undefined && haltedValue !== undefined;
  if (!ready) return { ready: false };

  if (live !== 1n) return { ready, blockedReason: 'psm_unavailable' };
  if (getPsmDirectionHalted({ direction: 'USDC_TO_USDS', feeWad: tin, haltedValue })) {
    return { ready, blockedReason: 'direction_halted' };
  }
  if (tin > 0n) return { ready, blockedReason: 'non_zero_fee' };

  return { ready };
}
