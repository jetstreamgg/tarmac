import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { PopoverRateInfo } from '@/widgets';
import { RateInfo } from '@/components/product/RateInfo';
import { useStUsdsData } from '@/hooks';
import { calculateApyFromStr, formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { PositionHero } from '@/components/product/PositionHero';
import { PositionCardSkeleton } from '@/components/product/PositionCardSkeleton';
import {
  ProductActions,
  ProductBadge,
  ProductFigure,
  ProductPercent,
  ProductPositionCard,
  ProductStat,
  ProductStatPair,
  ProductSupplyCard
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { EarningsFigureValue } from '@/modules/portfolio/components/EarningsStat';
import { earningsForPosition } from '@/modules/portfolio/earnings/earningsForPosition';
import { useWalletEarnings } from '@/modules/portfolio/hooks/useWalletEarnings';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useStUsdsModal } from '../hooks/useStUsdsModal';
import { NO_VALUE } from '@/lib/constants';

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
  const onSupplyOrConnect = useConnectThenAct(onSupply, 'stusds_supply');

  const rateLabel = rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE;
  const idleBalance =
    isConnected && stUsdsData
      ? formatNumber(parseFloat(formatUnits(stUsdsData.userUsdsBalance, 18)), { maxDecimals: 2 })
      : NO_VALUE;

  const usdsToken = (
    <span className="whitespace-nowrap">
      <TokenIcon
        token={{ symbol: 'USDS' }}
        width={24}
        showChainIcon={false}
        className="mr-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6"
      />
      USDS
    </span>
  );

  return (
    <ProductSupplyCard
      data-testid="stusds-supply-card"
      // No comp of its own (APP-432 item 16) — the badge follows the savings card.
      badges={
        <ProductBadge
          icon={
            <TokenIcon token={{ symbol: 'stUSDS' }} width={12} showChainIcon={false} className="h-3 w-3" />
          }
        >
          <Trans>stUSDS</Trans>
        </ProductBadge>
      }
      title={
        <Trans>
          Supply {usdsToken} at {rateLabel}
        </Trans>
      }
      description={
        <Trans>
          stUSDS gives you a variable reward rate on USDS by participating in SKY-backed borrowing.
          Withdrawals may be delayed during periods of high utilization.
        </Trans>
      }
      stats={
        <ProductStatPair>
          <ProductStat size="lg" label={<Trans>Current Rate</Trans>}>
            <ProductFigure value={rateLabel}>
              {rateLabel}
              <TokenIcon
                token={{ symbol: 'stUSDS' }}
                width={16}
                showChainIcon={false}
                className="h-4 w-4 shrink-0"
              />
              <PopoverRateInfo type="stusds" width={14} height={14} iconClassName="text-fgSecondary" />
            </ProductFigure>
          </ProductStat>
          <ProductStat size="lg" label={<Trans>Idle balance</Trans>}>
            <ProductFigure value={idleBalance}>
              {idleBalance}
              <TokenIcon
                token={{ symbol: 'USDS' }}
                width={16}
                showChainIcon={false}
                className="h-4 w-4 shrink-0"
              />
            </ProductFigure>
          </ProductStat>
        </ProductStatPair>
      }
      cta={
        <Button
          variant="primary"
          size="l"
          className="w-full"
          onClick={onSupplyOrConnect}
          data-testid="stusds-supply-cta"
        >
          <Trans>Supply</Trans>
        </Button>
      }
    />
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

  // "Accrued to date" is the same per-row slice the Portfolio renders for the
  // stUSDS row (APP-450) — the announced "Not yet available." gap until
  // vaults.fyi indexes stUSDS holders; react-query shares the fetches.
  const walletEarnings = useWalletEarnings();
  const accrued = earningsForPosition(walletEarnings, 'stusds');

  // Hold the card slot until the position read resolves — deciding on the 0n
  // fallback flashes the supply pitch at users who hold a position.
  if (isConnected && stUsdsData === undefined) {
    return <PositionCardSkeleton testId="stusds-position-card-skeleton" />;
  }

  if (suppliedUsds === 0n) {
    return <StUsdsSupplyCard rate={rate} onSupply={() => openSupply()} />;
  }

  const suppliedValue = parseFloat(formatUnits(suppliedUsds, 18));
  const usdsIcon = (
    <TokenIcon token={{ symbol: 'USDS' }} width={12} showChainIcon={false} className="h-3 w-3 shrink-0" />
  );
  const currentRate = rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE;

  return (
    <ProductPositionCard
      data-testid="stusds-position-card"
      hero={<PositionHero pillSymbol="stUSDS" balanceSymbol="USDS" amount={suppliedValue} />}
      // No comp of its own (APP-432 item 16) — the grid follows the savings card.
      stats={
        <>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Supply</Trans>}>
              {usdsIcon}
              {formatNumber(suppliedValue, { maxDecimals: 2 })}
            </ProductStat>
            <ProductStat label={<Trans>Est. 1Y yield (at current rate)</Trans>}>
              <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
              {formatNumber(projectAnnualEarnings(suppliedValue, rate), { maxDecimals: 2 })}
              {usdsIcon}
            </ProductStat>
          </ProductStatPair>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Accrued to date</Trans>}>
              <EarningsFigureValue
                figure={accrued?.totalEarned ?? null}
                missing={accrued?.missingFromTotal}
                coverage={accrued?.coverage}
                variant="plain"
                className={accrued?.totalEarned?.status === 'ok' ? undefined : 'text-fgSecondary'}
                skeletonClassName="h-4 w-14"
                testId="stusds-accrued-to-date"
              />
            </ProductStat>
            <ProductStat label={<Trans>Current rate</Trans>}>
              <ProductPercent value={currentRate} />
              <RateInfo type="stusds" size={12} />
            </ProductStat>
          </ProductStatPair>
        </>
      }
      actions={
        <ProductActions>
          <Button
            variant="primary"
            size="l"
            onClick={() => openSupply()}
            disabled={!isConnected}
            data-testid="stusds-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            size="l"
            onClick={() => openWithdraw()}
            disabled={!isConnected}
            data-testid="stusds-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </ProductActions>
      }
    />
  );
}
