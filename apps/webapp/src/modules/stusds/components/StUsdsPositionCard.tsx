import { ReactNode, useCallback } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useStUsdsData } from '@/hooks';
import { calculateApyFromStr, formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PositionHero } from '@/components/product/PositionHero';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useStUsdsModal } from '../hooks/useStUsdsModal';

const NO_VALUE = '–';

function StatRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

/**
 * No-position stUSDS entry card: "Supply USDS and earn X%" headline, the
 * expert-module blurb, Current Rate / Idle balance stats and a full-width
 * Supply CTA — mirrors PendleSupplyCard/VaultSupplyCard. No inline input;
 * amount entry (and the one-time risk acknowledgement) happens in the modal.
 */
function StUsdsSupplyCard({ rate, onSupply }: { rate?: number; onSupply: () => void }) {
  const { isConnected } = useConnection();
  const { data: stUsdsData } = useStUsdsData();

  // The CTA stays enabled while disconnected: clicking routes through the
  // connect flow and continues into the supply modal once connected.
  const onSupplyOrConnect = useConnectThenAct(onSupply);

  const rateLabel = rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE;
  const idleBalance =
    isConnected && stUsdsData
      ? formatNumber(parseFloat(formatUnits(stUsdsData.userUsdsBalance, 18)), { maxDecimals: 2 })
      : NO_VALUE;

  return (
    <Card className="flex flex-col gap-6 p-6" data-testid="stusds-supply-card">
      <h3 className="text-text text-2xl leading-snug font-medium">
        <Trans>
          Supply{' '}
          <span className="whitespace-nowrap">
            <TokenIcon
              token={{ symbol: 'USDS' }}
              width={24}
              showChainIcon={false}
              className="mr-1 inline-block h-6 w-6 -translate-y-0.5 align-middle"
            />
            USDS
          </span>{' '}
          and earn {rateLabel}
        </Trans>
      </h3>

      <p className="text-textSecondary text-sm leading-relaxed">
        <Trans>
          stUSDS gives you a variable reward rate on USDS by participating in SKY-backed borrowing. It is an
          expert module intended for experienced users — withdrawals may be delayed during periods of high
          utilization.
        </Trans>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Current Rate</Trans>
          </span>
          <span className="text-text flex items-center gap-1.5 font-medium">
            {rateLabel}
            <TokenIcon
              token={{ symbol: 'stUSDS' }}
              width={18}
              showChainIcon={false}
              className="h-4.5 w-4.5"
            />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Idle balance</Trans>
          </span>
          <span className="text-text flex items-center gap-1.5 font-medium">
            {idleBalance}
            <TokenIcon token={{ symbol: 'USDS' }} width={18} showChainIcon={false} className="h-4.5 w-4.5" />
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={onSupplyOrConnect}
        data-testid="stusds-supply-cta"
      >
        <Trans>Supply</Trans>
      </Button>
    </Card>
  );
}

/**
 * Position-aware action card for the stUSDS product page (ProductDetailTemplate
 * `position` slot). The user's supplied balance picks the card:
 *  - no position (incl. disconnected) → the no-position "Supply" entry card.
 *  - has a position → the "My position" summary with Supply / Withdraw buttons
 *    that open the shared modal.
 */
export function StUsdsPositionCard() {
  const { isConnected } = useConnection();
  const { data: stUsdsData, mutate: mutateStUsds } = useStUsdsData();

  const suppliedUsds = stUsdsData?.userSuppliedUsds ?? 0n;
  const rate = stUsdsData ? calculateApyFromStr(stUsdsData.moduleRate) / 100 : undefined;

  const refresh = useCallback(() => {
    mutateStUsds();
  }, [mutateStUsds]);

  const { openSupply, openWithdraw } = useStUsdsModal({ onSuccess: refresh });

  if (suppliedUsds === 0n) {
    return <StUsdsSupplyCard rate={rate} onSupply={() => openSupply()} />;
  }

  const suppliedValue = parseFloat(formatUnits(suppliedUsds, 18));
  const shares = formatNumber(parseFloat(formatUnits(stUsdsData?.userStUsdsBalance ?? 0n, 18)), {
    maxDecimals: 2
  });

  return (
    <Card className="flex flex-col gap-5 p-2" data-testid="stusds-position-card">
      <PositionHero pillSymbol="stUSDS" balanceSymbol="USDS" amount={suppliedValue} />

      <div className="flex flex-col gap-5 px-3 pb-3">
        <div className="flex flex-col gap-3">
          <StatRow label={<Trans>stUSDS balance</Trans>}>
            <TokenIcon
              token={{ symbol: 'stUSDS' }}
              width={18}
              showChainIcon={false}
              className="h-4.5 w-4.5"
            />
            {shares}
          </StatRow>
          <StatRow label={<Trans>Rate</Trans>}>
            {rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE}
          </StatRow>
          <StatRow label={<Trans>Est. earnings (1Y)</Trans>}>
            ${formatNumber(projectAnnualEarnings(suppliedValue, rate), { maxDecimals: 2 })}
          </StatRow>
          {/* No cost-basis source for active positions yet — placeholder per the
              redesign (matches the vault card's earned-interest gap). */}
          <StatRow label={<Trans>Interest earned</Trans>}>
            <span className="text-textSecondary">{NO_VALUE}</span>
          </StatRow>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => openSupply()}
            disabled={!isConnected}
            data-testid="stusds-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => openWithdraw()}
            disabled={!isConnected}
            data-testid="stusds-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </Card>
  );
}
