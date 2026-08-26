import { useChainId } from 'wagmi';
import { formatUnits, type Call } from 'viem';
import { t } from '@lingui/core/macro';
import {
  RiskLevel,
  useDelegateName,
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  useSkyPrice,
  ZERO_ADDRESS,
  type Vault
} from '@/hooks';
import { capitalizeFirstLetter, formatAddress, formatBigInt, formatPercent, formatUsd } from '@/utils';
import { NO_VALUE } from '@/lib/constants';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { formatOraclePrice } from '../lib/formatStakeAmount';
import { buildStakeConfirmRows, type StakeDelegateSide, type StakeRewardSide } from './stakeModalRows';

/** A reward-farm endpoint: the farm, plus its reward-token symbol when known. */
export interface StakeRewardEndpoint {
  address: `0x${string}`;
  /** Missing = outside the address books with the on-chain symbol unresolved — renders the shortened farm address. */
  symbol?: string;
}

const formatSky = (amount: bigint) => `${formatBigInt(amount, { maxDecimals: 2 })} SKY`;
const formatRate = (rate: number | null) => (rate !== null ? `${(rate * 100).toFixed(2)}%` : NO_VALUE);

/**
 * The latest published rate for ONE farm, as a decimal. `useMultipleRewardsChartInfo`
 * returns its series index-aligned with the addresses it was given, so a single-address
 * call reduces to that farm's own latest point (no cross-farm "highest" blending).
 * Disabled when no farm is passed — the common no-switch case costs nothing.
 */
function useFarmRate(farm?: `0x${string}`): { rate: number | null; isLoading: boolean } {
  const { data, isLoading } = useMultipleRewardsChartInfo({
    rewardContractAddresses: farm ? [farm] : []
  });
  const latest = useHighestRateFromChartData(data ?? []);
  const parsed = latest ? parseFloat(latest.rate) : NaN;
  return { rate: Number.isFinite(parsed) ? parsed : null, isLoading: !!farm && isLoading };
}
const formatUsds = (amount: bigint) => `${formatBigInt(amount, { maxDecimals: 2 })} USDS`;

/** Icon symbol + label for one side of the Reward cell. */
const rewardSide = (endpoint: StakeRewardEndpoint | undefined, none: string): StakeRewardSide =>
  endpoint
    ? { symbol: endpoint.symbol, label: endpoint.symbol ?? formatAddress(endpoint.address, 6, 4) }
    : { label: none };

export type StakeConfirmGridProps = {
  /** The engine's calls, live — prices the Network fee estimate. */
  calls: Call[];
  /**
   * Legs the flow sends when bundled. Kept separate from `calls.length`, which
   * describes the CURRENT route: with bundling off the engine hands back a
   * single collapsed `multicall`, and inferring from that would hide the fee
   * cell's own bundle toggle from everyone who has bundling switched off.
   */
  legCount: number;
  /** False on the open flow: there is no "before", so every cell shows one value. */
  hasPosition: boolean;
  /** Staked SKY before / after the staged legs (wad). */
  stakedBefore: bigint;
  stakedAfter: bigint;
  /** Debt before / after (wad). */
  debtBefore: bigint;
  debtAfter: bigint;
  /** The vault as it stands, and as the staged legs leave it — risk + liquidation price. */
  vaultBefore: Vault | undefined;
  vaultAfter: Vault | undefined;
  /** Annualized stability fee (wad ratio) — the Borrow rate cell. */
  stabilityFee: bigint | undefined;
  /** The urn's current farm, and the staged one when a switch is in play. */
  rewardFrom?: StakeRewardEndpoint;
  rewardTo?: StakeRewardEndpoint;
  /** The urn's current delegate, and the staged one when a switch is in play. */
  delegateFrom?: `0x${string}`;
  delegateTo?: `0x${string}`;
  /** Draw the Reward / Delegate pair even when neither is changing (the open flow names both). */
  showSelections?: boolean;
};

/**
 * The stake confirm modal's detail grid (the shared two-column
 * `ModalSummaryGrid` every other product review draws): what the position
 * looks like before and after the staged legs, the rates behind those numbers,
 * and the transaction's own facts — Network and the live Network fee.
 *
 * It renders INSIDE the transaction modal (the launch hooks carry it as
 * `transactionContent`), so its own hooks run there: the fee estimate keeps
 * refreshing on the review screen, and the rates, prices and delegate names
 * resolve late without the takeover having to wait for them. What it is handed
 * as props — the engine's routing and the position's figures — the launch hook
 * re-pushes as those change (`useStakeConfirmContent`), until the transaction
 * leaves IDLE.
 */
export function StakeConfirmGrid({
  calls,
  legCount,
  hasPosition,
  stakedBefore,
  stakedAfter,
  debtBefore,
  debtAfter,
  vaultBefore,
  vaultAfter,
  stabilityFee,
  rewardFrom,
  rewardTo,
  delegateFrom,
  delegateTo,
  showSelections
}: StakeConfirmGridProps) {
  const chainId = useChainId();
  // Derived from the flow's leg count, not from `calls`: the fee cell renders
  // the bundle TOGGLE, and the calls describe whichever route that toggle is
  // currently on.
  const shouldUseBatch = useShouldUseBatch(legCount > 1);
  const feeCell = useModalFeeCell({ calls, chainId, shouldUseBatch, legCount });
  const networkName = useNetworkName(chainId, NO_VALUE);

  const { data: delegateFromName } = useDelegateName(delegateFrom);
  const { data: delegateToName } = useDelegateName(delegateTo);

  // Both farms' rates are resolved here rather than handed in: the modal
  // outlives the press, and a rate still in flight at Confirm-press would
  // otherwise be frozen on its skeleton for the modal's whole lifetime. The
  // staged farm needs its own read regardless — without it the review would
  // draw `Reward: SKY → USDS` beside the OLD farm's rate and project the
  // after-position at it, a figure that position will never earn.
  const currentRate = useFarmRate(rewardFrom?.address);
  const stagedRate = useFarmRate(rewardTo?.address);
  const rateBefore = currentRate.rate;
  const rateAfter = rewardTo ? stagedRate.rate : rateBefore;

  const { priceString: skyPriceString, isLoading: priceLoading } = useSkyPrice();
  const skyPriceUsd = skyPriceString ? parseFloat(skyPriceString) : null;
  const ratesLoading = currentRate.isLoading || stagedRate.isLoading || priceLoading;

  // Annual staking rewards, in USD. The BA Labs rate is a VALUE APR, so
  // `staked × rate` is a SKY-equivalent value rather than a count of any one
  // token — and this is the first surface that shows it across a farm switch,
  // where labelling it in SKY beside `Reward: SKY → USDS` states the wrong
  // token outright. USD is what the position details modal and the rewards
  // module's own review already quote.
  const estRewards = (staked: bigint, rate: number | null) =>
    rate !== null && skyPriceUsd !== null
      ? formatUsd(Number(formatUnits(staked, 18)) * rate * skyPriceUsd)
      : NO_VALUE;

  // The borrow group collapses whole on a position that neither owes nor is
  // taking on debt — four cells, so the pairing stays aligned either way.
  const hasBorrow = debtBefore > 0n || debtAfter > 0n;

  const riskLabel = (level: RiskLevel | undefined) =>
    level ? capitalizeFirstLetter(level.toLowerCase()) : NO_VALUE;

  // A named delegate wins; a shadow delegate (no metadata) falls back to its
  // shortened address, as the delegate list does.
  const delegateSide = (address: `0x${string}` | undefined, name: string | undefined): StakeDelegateSide => {
    if (!address || address === ZERO_ADDRESS) return { label: t`No delegate` };
    return {
      address,
      label: name && name !== 'Shadow delegate' ? name : formatAddress(address, 6, 4)
    };
  };

  const selectionsShown = showSelections || !!rewardTo || !!delegateTo;

  const rows = buildStakeConfirmRows({
    hasPosition,
    stakedBefore: formatSky(stakedBefore),
    stakedAfter: formatSky(stakedAfter),
    estRewardsBefore: estRewards(stakedBefore, rateBefore),
    estRewardsAfter: estRewards(stakedAfter, rateAfter),
    rewardRateBefore: formatRate(rateBefore),
    rewardRateAfter: formatRate(rateAfter),
    rateLoading: ratesLoading,
    borrow: hasBorrow
      ? {
          borrowedBefore: formatUsds(debtBefore),
          borrowedAfter: formatUsds(debtAfter),
          borrowRate: stabilityFee !== undefined ? formatPercent(stabilityFee) : NO_VALUE,
          riskBefore: vaultBefore?.riskLevel,
          riskAfter: vaultAfter?.riskLevel,
          riskLabelBefore: riskLabel(vaultBefore?.riskLevel),
          riskLabelAfter: riskLabel(vaultAfter?.riskLevel),
          liquidationBefore: formatOraclePrice(vaultBefore?.liquidationPrice),
          liquidationAfter: formatOraclePrice(vaultAfter?.liquidationPrice)
        }
      : undefined,
    selections: selectionsShown
      ? {
          rewardBefore: rewardSide(rewardFrom, t`None`),
          rewardAfter: rewardSide(rewardTo ?? rewardFrom, t`None`),
          rewardChanged: !!rewardTo,
          delegateBefore: delegateSide(delegateFrom, delegateFromName),
          delegateAfter: delegateSide(
            delegateTo ?? delegateFrom,
            delegateTo ? delegateToName : delegateFromName
          ),
          delegateChanged: !!delegateTo
        }
      : undefined,
    network: networkName,
    networkFee: feeCell.fee?.formatted ?? NO_VALUE
  });

  return (
    <div className="flex flex-col gap-6" data-testid="stake-confirm-grid">
      <ModalSummaryGrid rows={toGridCells(rows, 'stake-confirm-row', feeCell)} dividerClassName="h-6" />
      {feeCell.state.promoVisible && <BundleSavingsPromo saving={feeCell.fee!.batchSaving!} />}
    </div>
  );
}
