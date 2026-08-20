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
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { farmRewardSymbol } from '../lib/farmRewardSymbol';

/**
 * The card body — single-select farm list, mirroring `DelegateList`'s row
 * recipe with per-farm rate/TVL stats in place of "Total delegated" (2–3 farms,
 * so no search row). Deprecated farms are hidden EXCEPT `keepAddress` (the
 * position's current farm), which renders with a "Deprecated" chip and the
 * legacy choose-another-reward warning so the holder can switch away without
 * unstaking. Exported for the F5 manage sheet's Change reward card, which
 * shares the exact list under its own testid prefix.
 */
export function RewardList({
  selectedRewardContract,
  onSelect,
  keepAddress,
  dataTestIdPrefix = 'stake-takeover-reward'
}: {
  selectedRewardContract: `0x${string}` | undefined;
  onSelect: (rewardContract: `0x${string}`) => void;
  /** Current farm of an existing position — kept visible even when deprecated. */
  keepAddress?: `0x${string}`;
  dataTestIdPrefix?: string;
}) {
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
      <div className="flex flex-col gap-2">
        {[0, 1].map(row => (
          <Skeleton key={row} className="h-16 w-full rounded-2xl md:rounded-xl" />
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
      <ul className="flex flex-col gap-2" data-testid={`${dataTestIdPrefix}-list`}>
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
                  'flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors md:rounded-[20px] md:px-5 md:py-4',
                  isSelected
                    ? 'border-brandBorder from-brand3-start to-brand3-end bg-linear-to-b'
                    : 'border-borderPrimary bg-transparent'
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {symbol && (
                    <TokenIcon token={{ symbol }} width={24} className="h-6 w-6" showChainIcon={false} />
                  )}
                  <span className="text-text font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
                    {symbol ?? formatAddress(address, 6, 4)}
                  </span>
                  {deprecated && (
                    <span className="bg-surfaceAlt text-textSecondary font-circle rounded-full px-2 py-0.5 text-xs font-medium">
                      <Trans>Deprecated</Trans>
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-4 md:gap-6">
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-fgSecondary text-xs leading-[18px]">
                      <Trans>Rewards rate</Trans>
                    </span>
                    <span className="text-text font-circle text-sm leading-4 font-medium tracking-[-0.28px]">
                      {Number.isFinite(rate) ? formatDecimalPercentage(rate) : NO_VALUE}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-fgSecondary text-xs leading-[18px]">
                      <Trans>TVL</Trans>
                    </span>
                    <span className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px]">
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
 * Card 2 · Choose your reward token (APP-516, resolving A-Q2): always-on
 * single-select farm list — unlike the optional borrow/delegate cards there is
 * no toggle, because the engine requires a `selectFarm` call for rewards to
 * accrue; the SKY farm arrives pre-selected by the container.
 */
export function StakeTakeoverRewardCard({
  selectedRewardContract,
  onSelect,
  keepAddress
}: {
  selectedRewardContract: `0x${string}` | undefined;
  onSelect: (rewardContract: `0x${string}`) => void;
  keepAddress?: `0x${string}`;
}) {
  return (
    <StakeTakeoverCard
      step={2}
      title={<Trans>Choose your reward token</Trans>}
      dataTestId="stake-takeover-reward-card"
    >
      <RewardList
        selectedRewardContract={selectedRewardContract}
        onSelect={onSelect}
        keepAddress={keepAddress}
      />
    </StakeTakeoverCard>
  );
}
