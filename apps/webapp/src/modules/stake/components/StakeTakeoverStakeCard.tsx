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
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-textSecondary flex items-center gap-1 text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
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

      <div className="border-textSecondary/10 flex flex-wrap items-start gap-6 border-t pt-4">
        <StatItem label={<Trans>SKY Rewards rate</Trans>}>{rewardsRate ?? NO_VALUE}</StatItem>
        <StatItem label={<Trans>Est. annual rewards</Trans>}>
          <span data-testid="stake-takeover-est-rewards" className="flex items-center gap-1.5">
            {estAnnualRewards !== null && estAnnualRewards > 0n ? (
              <>
                {formatBigInt(estAnnualRewards)}
                <TokenIcon
                  token={{ symbol: rewardSymbol }}
                  width={16}
                  className="h-4 w-4"
                  showChainIcon={false}
                />
              </>
            ) : (
              NO_VALUE
            )}
          </span>
        </StatItem>
        {minStakeToBorrow !== undefined && (
          <StatItem
            label={
              <>
                <Trans>Min. stake to borrow</Trans>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </>
            }
          >
            <span data-testid="stake-takeover-min-stake" className="flex items-center gap-1.5">
              {formatBigInt(minStakeToBorrow)}
              <TokenIcon token={{ symbol: 'SKY' }} width={16} className="h-4 w-4" showChainIcon={false} />
            </span>
          </StatItem>
        )}
      </div>
    </StakeTakeoverCard>
  );
}
