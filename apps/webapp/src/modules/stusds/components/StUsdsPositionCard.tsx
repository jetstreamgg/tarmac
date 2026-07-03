import { ReactNode, useCallback } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useStUsdsData } from '@/hooks';
import {
  calculateApyFromStr,
  formatDecimalPercentage,
  formatNumber,
  projectAnnualEarnings,
  splitAmount
} from '@/utils';
import { Button } from '@/components/ui/button';
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
    <div
      className="bg-panel flex flex-col gap-6 rounded-[20px] p-6 backdrop-blur-2xl"
      data-testid="stusds-supply-card"
    >
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
    </div>
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
  const { whole, fraction } = splitAmount(suppliedValue);
  const shares = formatNumber(parseFloat(formatUnits(stUsdsData?.userStUsdsBalance ?? 0n, 18)), {
    maxDecimals: 2
  });

  return (
    <div
      className="bg-panel flex flex-col gap-5 rounded-[20px] p-2 backdrop-blur-2xl"
      data-testid="stusds-position-card"
    >
      {/* Hero — "My position" pill + supplied USDS over a soft brand-tinted inset. */}
      <div className="flex flex-col gap-6 rounded-2xl bg-[radial-gradient(130%_130%_at_15%_0%,_rgba(126,107,242,0.22)_0%,_rgba(58,46,125,0.1)_55%,_transparent_100%)] p-5">
        <span className="bg-surface text-textSecondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm">
          <TokenIcon token={{ symbol: 'stUSDS' }} width={16} showChainIcon={false} className="h-4 w-4" />
          <Trans>My position</Trans>
        </span>
        <span className="text-text flex items-end gap-2 font-semibold">
          <TokenIcon token={{ symbol: 'USDS' }} width={32} showChainIcon={false} className="mb-1 h-8 w-8" />
          <span className="text-4xl leading-none">{whole}</span>
          {fraction && <span className="text-textSecondary text-2xl leading-tight">.{fraction}</span>}
        </span>
      </div>

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
    </div>
  );
}
