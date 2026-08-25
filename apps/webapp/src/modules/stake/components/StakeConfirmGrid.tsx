import { useChainId } from 'wagmi';
import type { Call } from 'viem';
import { t } from '@lingui/core/macro';
import { RiskLevel, useDelegateName, ZERO_ADDRESS, type Vault } from '@/hooks';
import { capitalizeFirstLetter, formatAddress, formatBigInt, formatPercent } from '@/utils';
import { NO_VALUE } from '@/lib/constants';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
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
const formatUsds = (amount: bigint) => `${formatBigInt(amount, { maxDecimals: 2 })} USDS`;

/** Icon symbol + label for one side of the Reward cell. */
const rewardSide = (endpoint: StakeRewardEndpoint | undefined, none: string): StakeRewardSide =>
  endpoint
    ? { symbol: endpoint.symbol, label: endpoint.symbol ?? formatAddress(endpoint.address, 6, 4) }
    : { label: none };

export type StakeConfirmGridProps = {
  /** The engine's calls at launch — prices the live Network fee estimate. */
  calls: Call[];
  /** Whether the flow goes out as one EIP-5792 bundle (the fee cell's bundling panel). */
  isBatch: boolean;
  /** False on the open flow: there is no "before", so every cell shows one value. */
  hasPosition: boolean;
  /** Staked SKY before / after the staged legs (wad). */
  stakedBefore: bigint;
  stakedAfter: bigint;
  /** The urn farm's live staking-reward rate as a decimal (0.0569 = 5.69%), null when unresolved. */
  rewardsRate: number | null;
  /** The farm-rate read is in flight — the rate + est-rewards cells hold a skeleton. */
  rateLoading?: boolean;
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
 * refreshing on the review screen, and the delegate name resolves late without
 * the takeover having to wait for it.
 */
export function StakeConfirmGrid({
  calls,
  isBatch,
  hasPosition,
  stakedBefore,
  stakedAfter,
  rewardsRate,
  rateLoading,
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
  const feeCell = useModalFeeCell({ calls, chainId, shouldUseBatch: isBatch });
  const networkName = useNetworkName(chainId, NO_VALUE);

  const { data: delegateFromName } = useDelegateName(delegateFrom);
  const { data: delegateToName } = useDelegateName(delegateTo);

  // Annual staking rewards: rate × staked SKY, the same 1e9-scaled math F4 and
  // the manage stake card use, so the review can't disagree with the card.
  const estRewards = (staked: bigint) =>
    rewardsRate !== null && staked > 0n
      ? formatSky((staked * BigInt(Math.round(rewardsRate * 1_000_000_000))) / 1_000_000_000n)
      : rewardsRate !== null
        ? formatSky(0n)
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
    estRewardsBefore: estRewards(stakedBefore),
    estRewardsAfter: estRewards(stakedAfter),
    rewardRate: rewardsRate !== null ? `${(rewardsRate * 100).toFixed(2)}%` : NO_VALUE,
    rateLoading,
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
