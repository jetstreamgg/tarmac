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
 * Single-select farm picker. Layout follows the farm count (Figma 3015:59109
 * vs 3199:69364): exactly two farms render as side-by-side tiles at md+, each
 * an icon + name row over a Rate | TVL pair split by a hairline; any other
 * count stacks full-width compact rows (icon + name left, Rate | TVL
 * right-aligned) so the list scales past two. The selected entry takes the
 * brandBorder/brand3 ring. Deprecated farms are hidden EXCEPT `keepAddress`
 * (the position's current farm), which renders with a "Deprecated" chip and
 * the legacy choose-another-reward warning so the holder can switch away
 * without unstaking. The Change reward modal forces `columns={1}` (Figma
 * 3015:61498): taller 69px rows with a 24px icon and Body 6 / Label 5 stats.
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
  /** 1 = the Change reward modal's tall rows (Figma 3015:61490); omit to follow the farm count. */
  columns?: 1 | 2;
}) {
  const chainId = useChainId();
  const { data: rewardContracts, isLoading } = useStakeRewardContracts();
  const farms = filterDeprecatedRewards(rewardContracts ?? [], chainId, keepAddress);
  // Tall rows for the Change modal; otherwise tiles for exactly two farms and compact rows past that.
  const layout = columns === 1 ? 'rows' : farms.length === 2 ? 'tiles' : 'compact';
  const row = layout !== 'tiles';
  const tall = layout === 'rows';
  const gridClassName = cn('grid grid-cols-1 gap-3', !row && 'md:grid-cols-2');

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
  // Tiles and compact rows use Body 7 / Label 6; the tall row comp steps up to Body 6 / Label 5.
  const labelClassName = tall
    ? 'text-fgSecondary text-xs leading-[18px]'
    : 'text-fgSecondary text-[11px] leading-4';
  const valueClassName = tall
    ? 'text-text font-circle text-sm leading-4 font-medium tracking-[-0.28px]'
    : 'text-text font-circle text-xs leading-[14px] font-medium tracking-[-0.24px]';

  if (isLoading) {
    return (
      <div className={gridClassName}>
        {[0, 1].map(tile => (
          <Skeleton
            key={tile}
            className={cn('w-full', tall ? 'h-[69px] rounded-[20px]' : 'h-[113px] rounded-2xl')}
          />
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
                  'flex w-full border text-left transition-colors',
                  layout === 'rows' &&
                    'items-center justify-between gap-4 rounded-[20px] px-[19px] py-[15px]',
                  layout === 'compact' &&
                    'items-center justify-between gap-5 rounded-2xl px-[19px] py-[15px]',
                  layout === 'tiles' && 'flex-col gap-5 rounded-2xl p-[19px]',
                  isSelected
                    ? 'border-brandBorder from-brand3-start to-brand3-end bg-linear-to-b'
                    : 'border-borderPrimary bg-transparent'
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {symbol && (
                    <TokenIcon
                      token={{ symbol }}
                      width={tall ? 24 : 20}
                      className={tall ? 'h-6 w-6' : 'h-5 w-5'}
                      showChainIcon={false}
                    />
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
                <span className={cn('flex gap-4', row ? 'shrink-0 items-center' : 'items-start')}>
                  <span className={cn('flex w-12 flex-col gap-[3px]', row && 'items-end')}>
                    <span className={labelClassName}>
                      <Trans>Rate</Trans>
                    </span>
                    <span className={valueClassName}>
                      {Number.isFinite(rate) ? formatDecimalPercentage(rate) : NO_VALUE}
                    </span>
                  </span>
                  <span className="bg-borderPrimary h-8 w-px shrink-0" aria-hidden />
                  <span className={cn('flex w-12 flex-col gap-[3px]', row && 'items-end')}>
                    <span className={labelClassName}>
                      <Trans>TVL</Trans>
                    </span>
                    <span className={cn(valueClassName, 'flex items-center gap-1')}>
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
