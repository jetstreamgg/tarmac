import { ReactNode, useCallback } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { useSavingsData, useTokenBalance, useOverallSkyData, TOKENS } from '@/hooks';
import { formatDecimalPercentage, formatNumber, formatUsd, projectAnnualEarnings } from '@/utils';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PositionHero } from '@/components/product/PositionHero';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSavingsModal } from '../hooks/useSavingsModal';
import { SavingsSupplyCard } from './SavingsSupplyCard';

const NO_VALUE = '–';

const formatToken = (value?: bigint) =>
  value === undefined ? NO_VALUE : formatNumber(parseFloat(formatUnits(value, 18)), { maxDecimals: 2 });

function Stat({ label, className, children }: { label: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 font-medium">{children}</span>
    </div>
  );
}

/** Short vertical divider between the two stats in a row (per-row, not full-height). */
function StatDivider() {
  return <div className="bg-border mx-5 w-px self-stretch" />;
}

/**
 * Position-aware action card for the Savings product page (ProductDetailTemplate
 * `position` slot). The savings balance picks the card:
 *  - no position (incl. disconnected) → the no-position "Supply" entry card
 *    (`SavingsSupplyCard`), whose CTA opens the supply modal.
 *  - has position → the "My position" summary below, with Supply / Withdraw
 *    buttons that each open the shared editable modal (`SavingsModalForm`) for
 *    the chosen flow.
 *
 * Both branches confirm through `useSavingsLaunch()` (sUSDS deposit/withdraw +
 * DAI upgrade on mainnet, PSM swap on L2) — calldata unchanged. All amount entry
 * happens in the modal; neither card renders an inline input.
 */
export function SavingsPositionCard() {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const { data: savingsData, mutate: mutateSavings } = useSavingsData();
  const { data: susdsBalance, refetch: refetchSusds } = useTokenBalance({
    address,
    chainId,
    token: TOKENS.susds.address[chainId]
  });
  const { data: overall } = useOverallSkyData();
  // Refresh position card + sUSDS balance after a successful supply/withdraw.
  // A no-position supply also flips this card to "My position" once the savings
  // balance refetches above zero.
  const refreshPosition = useCallback(() => {
    mutateSavings();
    refetchSusds();
  }, [mutateSavings, refetchSusds]);

  // Supply/withdraw triggers for the editable modal (shared with any other surface
  // that opens this flow, e.g. Portfolio quick-deposit).
  const { openSupply, openWithdraw } = useSavingsModal({ onSuccess: refreshPosition });

  const hasPosition = (savingsData?.userSavingsBalance ?? 0n) > 0n;
  if (!hasPosition) {
    return <SavingsSupplyCard onSupply={() => openSupply()} />;
  }

  // Position is USDS-denominated (18-dec, includes accrued earnings). Treated as
  // its USD value for projections — USDS is $1-pegged, the convention across the
  // savings surfaces.
  const positionValue = parseFloat(formatUnits(savingsData?.userSavingsBalance ?? 0n, 18));
  const susds = isConnected ? formatToken(susdsBalance?.value) : NO_VALUE;

  const rateValue = overall?.skySavingsRatecRate ? parseFloat(overall.skySavingsRatecRate) : undefined;
  const currentRate = rateValue !== undefined ? formatDecimalPercentage(rateValue) : NO_VALUE;
  const projectedEarnings = projectAnnualEarnings(positionValue, rateValue);

  return (
    <Card className="flex flex-col gap-5 p-2" data-testid="savings-position-card">
      <PositionHero pillSymbol="sUSDS" balanceSymbol="USDS" amount={positionValue} />

      <div className="flex flex-col gap-5 px-3 pb-3">
        {/* Stats laid out as two rows, each pair split by its own short divider. */}
        <div className="flex flex-col gap-5">
          <div className="flex">
            {/* No cost-basis source yet → dash (PRD: unavailable values read "–"). */}
            <Stat className="flex-1" label={<Trans>Already earned</Trans>}>
              <span className="text-textSecondary">{NO_VALUE}</span>
            </Stat>
            <StatDivider />
            <Stat className="flex-1" label={<Trans>1Y projected earnings</Trans>}>
              <TrendingUp className="text-bullish h-4 w-4" />
              {formatUsd(projectedEarnings)}
              <TokenIcon token={{ symbol: 'USDS' }} width={16} showChainIcon={false} className="h-4 w-4" />
            </Stat>
          </div>
          <div className="flex">
            <Stat className="flex-1" label={<Trans>sUSDS balance</Trans>}>
              <TokenIcon
                token={{ symbol: 'sUSDS' }}
                width={18}
                showChainIcon={false}
                className="h-4.5 w-4.5"
              />
              {susds}
            </Stat>
            <StatDivider />
            <Stat className="flex-1" label={<Trans>Current rate</Trans>}>
              {currentRate}
            </Stat>
          </div>
        </div>

        {/* Supply / Withdraw each open the editable modal for their flow. */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => openSupply()}
            disabled={!isConnected}
            data-testid="savings-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => openWithdraw()}
            disabled={!isConnected}
            data-testid="savings-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </Card>
  );
}
