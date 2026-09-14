import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import {
  filterDeprecatedRewards,
  isDeprecatedStakeReward,
  useMultipleRewardsChartInfo,
  useStakeRewardContracts
} from '@/hooks';
import { formatAddress, formatDecimalPercentage, formatNumber } from '@/utils';
import { cn } from '@/lib/cn';
import { NO_VALUE } from '@/lib/constants';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { farmRewardSymbol } from '../lib/farmRewardSymbol';

/**
 * Single-select farm tiles (Figma 3015:59025): two side-by-side tiles at md+,
 * each an icon + name row over a Rate | TVL pair split by a hairline; the
 * selected tile takes the brandBorder/brand3 ring. Deprecated farms are hidden
 * EXCEPT `keepAddress` (the position's current farm), which renders with a
 * "Deprecated" chip and the legacy choose-another-reward warning so the holder
 * can switch away without unstaking. Shared with the Change reward modal
 * (single column) under its own testid prefix.
 */
export function RewardList({
  selectedRewardContract,
  onSelect,
  keepAddress,
  dataTestIdPrefix = 'stake-takeover-reward',
  columns = 2
}: {
  selectedRewardContract: `0x${string}` | undefined;
  onSelect: (rewardContract: `0x${string}`) => void;
  /** Current farm of an existing position — kept visible even when deprecated. */
  keepAddress?: `0x${string}`;
  dataTestIdPrefix?: string;
  /** 1 = full-width stacked tiles (the Change reward modal, Figma 3015:61490). */
  columns?: 1 | 2;
}) {
  const gridClassName = cn('grid grid-cols-1 gap-3', columns === 2 && 'md:grid-cols-2');
  const chainId = useChainId();
  const { data: rewardContracts, isLoading } = useStakeRewardContracts();
  const farms = filterDeprecatedRewards(rewardContracts ?? [], chainId, keepAddress);

  const { data: chartInfo } = useMultipleRewardsChartInfo({
    rewardContractAddresses: farms.map(farm => farm.contractAddress)
  });
  // The chart series arrive aligned to the input address order.
  const latestFor = (index: number) => {
    const series = chartInfo?.[index];
    if (!series || series.length === 0) return undefined;
    return [...series].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];
  };

  const currentFarmDeprecated = !!keepAddress && isDeprecatedStakeReward(keepAddress, chainId);

  if (isLoading) {
    return (
      <div className={gridClassName}>
        {[0, 1].map(tile => (
          <Skeleton key={tile} className="h-[113px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <p className="text-fgSecondary py-6 text-center text-sm">
        <Trans>No rewards found</Trans>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className={gridClassName} data-testid={`${dataTestIdPrefix}-list`}>
        {farms.map((farm, index) => {
          const address = farm.contractAddress;
          const isSelected = selectedRewardContract?.toLowerCase() === address.toLowerCase();
          const symbol = farmRewardSymbol(address, chainId);
          const deprecated = isDeprecatedStakeReward(address, chainId);
          const latest = latestFor(index);
          const rate = latest ? parseFloat(latest.rate) : NaN;
          const tvl = latest ? parseFloat(latest.totalSupplied) : NaN;
          return (
            <li key={address}>
              <button
                type="button"
                onClick={() => onSelect(address)}
                data-testid={`${dataTestIdPrefix}-${address.toLowerCase()}`}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full flex-col gap-5 rounded-2xl border p-[19px] text-left transition-colors',
                  isSelected
                    ? 'border-brandBorder from-brand3-start to-brand3-end bg-linear-to-b'
                    : 'border-borderPrimary bg-transparent'
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {symbol && (
                    <TokenIcon token={{ symbol }} width={20} className="h-5 w-5" showChainIcon={false} />
                  )}
                  <span className="text-text font-circle truncate text-base leading-[18px] font-medium tracking-[-0.32px]">
                    {symbol ?? formatAddress(address, 6, 4)}
                  </span>
                  {deprecated && (
                    <span className="bg-surfaceAlt text-textSecondary font-circle rounded-full px-2 py-0.5 text-xs font-medium">
                      <Trans>Deprecated</Trans>
                    </span>
                  )}
                </span>
                <span className="flex items-start gap-4">
                  <span className="flex w-12 flex-col gap-[3px]">
                    <span className="text-fgSecondary text-[11px] leading-4">
                      <Trans>Rate</Trans>
                    </span>
                    <span className="text-text font-circle text-xs leading-[14px] font-medium tracking-[-0.24px]">
                      {Number.isFinite(rate) ? formatDecimalPercentage(rate) : NO_VALUE}
                    </span>
                  </span>
                  <span className="bg-borderPrimary h-8 w-px shrink-0" aria-hidden />
                  <span className="flex w-12 flex-col gap-[3px]">
                    <span className="text-fgSecondary text-[11px] leading-4">
                      <Trans>TVL</Trans>
                    </span>
                    <span className="text-text font-circle flex items-center gap-1 text-xs leading-[14px] font-medium tracking-[-0.24px]">
                      {Number.isFinite(tvl) ? formatNumber(tvl, { compact: true, maxDecimals: 2 }) : NO_VALUE}
                      <TokenIcon
                        token={{ symbol: 'SKY' }}
                        width={12}
                        className="h-3 w-3"
                        showChainIcon={false}
                      />
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {currentFarmDeprecated && (
        // Copy kept verbatim so the existing translation carries over.
        <p
          data-testid={`${dataTestIdPrefix}-deprecated-warning`}
          className="text-textSecondary text-xs leading-[18px]"
        >
          <Trans>
            Please <span className="text-text font-circle font-medium">choose another reward.</span> The SPK
            rewards are disabled as a Staking Reward option, and the SPK rate set to zero. The pool of SPK
            will remain forever so that you can claim your rewards anytime.
          </Trans>
        </p>
      )}
    </div>
  );
}

/**
 * "Reward token" block inside card 1 (Figma 3015:59023): muted label over the
 * farm tiles, between the amount field and the stat rows. Always-on with no
 * toggle, because the engine requires a `selectFarm` call for rewards to
 * accrue; the SKY farm arrives pre-selected by the container.
 */
export function StakeTakeoverRewardField({
  selectedRewardContract,
  onSelect,
  keepAddress
}: {
  selectedRewardContract: `0x${string}` | undefined;
  onSelect: (rewardContract: `0x${string}`) => void;
  keepAddress?: `0x${string}`;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid="stake-takeover-reward-field">
      <span className="text-fgSecondary text-xs leading-[18px]">
        <Trans>Reward token</Trans>
      </span>
      <RewardList
        selectedRewardContract={selectedRewardContract}
        onSelect={onSelect}
        keepAddress={keepAddress}
      />
    </div>
  );
}
