import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info } from 'lucide-react';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';

const NO_VALUE = '–';

function StatItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-fgSecondary md:text-textSecondary text-xs leading-[18px] md:flex md:items-center md:gap-1 md:text-sm md:leading-5">
        {label}
      </span>
      <span className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px] md:gap-1.5 md:font-sans md:leading-5 md:tracking-normal">
        {children}
      </span>
    </div>
  );
}

/** Mobile-only 32px hairline between the stat columns (comp 1222:19772). */
function StatDivider() {
  return <span aria-hidden className="bg-borderPrimary h-8 w-px shrink-0 self-center md:hidden" />;
}

/**
 * Card 1 · Stake SKY: amount + balance/percent chips + rewards-rate stats. The
 * `Min. stake to borrow` stat appears only while Borrow is enabled (UX §A.2).
 * Est. annual rewards shows "–" until an amount is entered.
 */
export function StakeTakeoverStakeCard({
  amount,
  onAmountChange,
  balance,
  balanceLoading,
  rewardsRate,
  estAnnualRewards,
  rewardSymbol,
  minStakeToBorrow,
  error
}: {
  amount: bigint;
  onAmountChange: (amount: bigint) => void;
  balance: bigint | undefined;
  balanceLoading?: boolean;
  /** Formatted percentage (e.g. "1.50%") or null while loading/unavailable. */
  rewardsRate: string | null;
  /** In reward-token units; null renders the design's "–" empty marker. */
  estAnnualRewards: bigint | null;
  rewardSymbol: string;
  /** Shown only when Borrow is enabled (minCollateralForDust). */
  minStakeToBorrow: bigint | undefined;
  error?: string;
}) {
  const onPercentClick = (percent: number) => {
    if (balance === undefined) return;
    onAmountChange(percent === 100 ? balance : (balance * BigInt(percent)) / 100n);
  };

  return (
    <StakeTakeoverCard step={1} title={<Trans>Stake SKY</Trans>} dataTestId="stake-takeover-stake-card">
      <StakeTakeoverAmountField
        tokenSymbol="SKY"
        amount={amount}
        onAmountChange={onAmountChange}
        onPercentClick={onPercentClick}
        error={error}
        dataTestId="stake-takeover-stake-amount"
        topRight={
          balanceLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <Trans>Balance: {balance !== undefined ? formatBigInt(balance) : NO_VALUE} SKY</Trans>
          )
        }
      />

      <div className="border-textSecondary/10 -mt-3 flex items-center gap-4 border-t pt-6 md:mt-0 md:flex-wrap md:items-start md:gap-6 md:pt-4">
        <StatItem label={<Trans>SKY Rewards rate</Trans>}>{rewardsRate ?? NO_VALUE}</StatItem>
        <StatDivider />
        <StatItem label={<Trans>Est. annual rewards</Trans>}>
          <span data-testid="stake-takeover-est-rewards" className="flex items-center gap-1 md:gap-1.5">
            {estAnnualRewards !== null && estAnnualRewards > 0n ? (
              <>
                {formatBigInt(estAnnualRewards)}
                <TokenIcon
                  token={{ symbol: rewardSymbol }}
                  width={16}
                  className="h-3 w-3 md:h-4 md:w-4"
                  showChainIcon={false}
                />
              </>
            ) : (
              NO_VALUE
            )}
          </span>
        </StatItem>
        {minStakeToBorrow !== undefined && (
          <>
            <StatDivider />
            <StatItem
              label={
                <>
                  <Trans>Min. stake to borrow</Trans>
                  <Info
                    className="ml-1 inline h-3 w-3 shrink-0 align-[-2px] md:ml-0 md:h-3.5 md:w-3.5 md:align-baseline"
                    aria-hidden
                  />
                </>
              }
            >
              <span data-testid="stake-takeover-min-stake" className="flex items-center gap-1 md:gap-1.5">
                {formatBigInt(minStakeToBorrow)}
                <TokenIcon
                  token={{ symbol: 'SKY' }}
                  width={16}
                  className="h-3 w-3 md:h-4 md:w-4"
                  showChainIcon={false}
                />
              </span>
            </StatItem>
          </>
        )}
      </div>
    </StakeTakeoverCard>
  );
}
