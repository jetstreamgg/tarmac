import { useCallback } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { mainnet } from 'viem/chains';
import { formatUnits } from 'viem';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import {
  isMarketMatured,
  isPendleChain,
  TOKENS,
  usePendleMarketsApiData,
  usePendleMaturedPositionEarnings,
  usePendleRedeemPreview,
  usePendleUserPtBalances,
  useTokenBalance,
  type PendleMarketConfig
} from '@/hooks';
import { formatDecimalPercentage, formatNumber, isTestnetId } from '@/utils';
import { Button } from '@/components/ui/button';
import { HeaderBadge } from '@/components/ui/page-header';
import { Pendle } from '@/widgets';
import { PositionHero } from '@/components/product/PositionHero';
import { PositionCardSkeleton } from '@/components/product/PositionCardSkeleton';
import {
  NO_VALUE,
  ProductActions,
  ProductFigure,
  ProductPercent,
  ProductPositionCard,
  ProductStat,
  ProductStatPair,
  ProductSupplyCard
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

import { Text } from '@/modules/layout/components/Typography';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { usePendleModal } from '../hooks/usePendleModal';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';
import { usePendleMaturedNetworkSwitch } from '../hooks/usePendleMaturedPositions';
import { formatMaturity } from '@/modules/earn/helpers/formatMaturity';

const SECONDS_PER_DAY = 86_400;

/**
 * No-position Pendle entry card (Figma 486:33862): "Supply USDS/USDC and earn
 * X% APY" headline, fixed-yield blurb, Current Rate / Idle balance stats and a
 * full-width Supply CTA. No inline input — amount entry happens in the modal.
 */
function PendleSupplyCard({
  market,
  fixedApy,
  remainingDays,
  onSupply
}: {
  market: PendleMarketConfig;
  fixedApy?: number;
  remainingDays: number;
  onSupply: () => void;
}) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();

  // The CTA stays enabled while disconnected: clicking routes through the
  // connect flow and continues into the supply modal once connected.
  const onSupplyOrConnect = useConnectThenAct(onSupply, 'pendle_supply');

  // Pendle markets are mainnet-only; balances follow the fork in dev mode.
  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;

  const { data: balance } = useTokenBalance({
    address,
    chainId: balanceChainId,
    token: TOKENS.usds.address[balanceChainId]
  });

  const rate = fixedApy !== undefined ? formatDecimalPercentage(fixedApy) : NO_VALUE;
  const idleBalance =
    isConnected && balance
      ? formatNumber(parseFloat(formatUnits(balance.value, 18)), { maxDecimals: 2 })
      : NO_VALUE;

  const inlineToken = (symbol: string) => (
    <span className="whitespace-nowrap">
      <TokenIcon
        token={{ symbol }}
        width={24}
        showChainIcon={false}
        className="mr-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6"
      />
      {symbol}
    </span>
  );

  return (
    <ProductSupplyCard
      data-testid="pendle-supply-card"
      badges={
        /* The comp (859:40958) pairs the category badge with the provider one. */
        <div className="flex flex-wrap items-center gap-2">
          <HeaderBadge size="s" className="pl-2">
            <Trans>Fixed yield</Trans>
          </HeaderBadge>
          <HeaderBadge size="s" icon={<Pendle className="size-4" />}>
            <Trans>Powered by Pendle</Trans>
          </HeaderBadge>
        </div>
      }
      title={
        <Trans>
          Supply {inlineToken('USDS')} / {inlineToken('USDC')} at {rate} APY
        </Trans>
      }
      description={
        <Trans>
          Fixed yield markets let you supply USDS and walk away with a guaranteed return at the market
          maturity. Fix your yield at {rate} APY for the next {remainingDays} days.
        </Trans>
      }
      stats={
        <ProductStatPair>
          <ProductStat size="lg" label={<Trans>Current Rate</Trans>}>
            <ProductFigure value={rate}>
              {rate}
              <TokenIcon
                token={{ symbol: `PT-${market.underlyingSymbol}` }}
                width={16}
                showChainIcon={false}
                className="h-4 w-4 shrink-0"
              />
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
          data-testid="pendle-supply-cta"
        >
          <Trans>Supply</Trans>
        </Button>
      }
    />
  );
}

/**
 * Position-aware action card for the Pendle product page (ProductDetailTemplate
 * `position` slot, Figma 486:33862 / 486:33998). The user's PT balance picks
 * the card:
 *  - no PT (incl. disconnected) → the no-position "Supply" entry card.
 *  - holds PT → the "My position" summary with Supply / Withdraw buttons that
 *    open the shared modal.
 *
 * Matured markets now reach this card too: holders see the claim layout
 * (`PendleMaturedCard`), which is the detail page's half of the redemption
 * flow the Portfolio and Earn "Requires action" surfaces also open.
 */
/**
 * Matured-position card for the detail page (Figma 2193:73881): the claimable
 * figure over Accrued / Mature date, the ready-to-withdraw line, and a single
 * Claim CTA opening the redeem modal. Same content the Portfolio's
 * `PendleMaturedPositionCard` carries in the carousel's chrome — this one
 * wears the detail page's ProductPositionCard.
 *
 * The comp labels the accrued figure "Earned"; the app's copy standard renames
 * that family ("Already earned" → "Accrued to date"), so the label follows the
 * standard, as the active card's does.
 */
function PendleMaturedCard({
  market,
  ptBalance,
  maturityLabel
}: {
  market: PendleMarketConfig;
  ptBalance: bigint;
  maturityLabel: string;
}) {
  const onPendleChain = isPendleChain(useChainId());
  // The claim signs on mainnet; this card is a claim surface, so it prompts the
  // switch the same way the Portfolio's matured cards do.
  usePendleMaturedNetworkSwitch(true);

  const { data: previewAmount, isLoading: previewLoading } = usePendleRedeemPreview(market, ptBalance);
  const { earnings, currency } = usePendleMaturedPositionEarnings(market, ptBalance);
  // The receive amount (post SY-rate conversion); the PT balance stands in
  // until the on-chain preview resolves — same decimals, transient gap.
  const claimAmount = parseFloat(
    formatUnits((previewAmount as bigint | undefined) ?? ptBalance, market.underlyingDecimals)
  );
  // Pegged markets (1 PT → 1 USDS at expiry) present the claim as USDS.
  const displaySymbol = market.usdsEquivalence === 'pegged' ? 'USDS' : market.underlyingSymbol;

  const { openRedeemModal, isRedeemable, isPrepared } = usePendleRedeemModal(market);

  return (
    <ProductPositionCard
      data-testid="pendle-matured-position-card"
      hero={<PositionHero pillSymbol={displaySymbol} balanceSymbol={displaySymbol} amount={claimAmount} />}
      stats={
        <>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Accrued</Trans>}>
              {earnings !== undefined && currency ? (
                <>
                  <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
                  {formatNumber(earnings, { maxDecimals: 2 })}
                  <TokenIcon
                    token={{ symbol: currency }}
                    width={12}
                    showChainIcon={false}
                    className="h-3 w-3 shrink-0"
                  />
                </>
              ) : (
                <span className="text-fgSecondary">{NO_VALUE}</span>
              )}
            </ProductStat>
            <ProductStat label={<Trans>Mature date</Trans>}>{maturityLabel}</ProductStat>
          </ProductStatPair>
          <Text variant="small" className="text-fgSecondary">
            {earnings !== undefined && earnings > 0 && currency ? (
              <Trans>
                Matured on {maturityLabel}. Your deposit and {formatNumber(earnings, { maxDecimals: 2 })}{' '}
                {currency} in yield are ready to withdraw.
              </Trans>
            ) : (
              <Trans>Matured on {maturityLabel}. Your deposit is ready to withdraw.</Trans>
            )}
          </Text>
        </>
      }
      actions={
        <div className="flex flex-col gap-2">
          <ProductActions>
            <Button
              variant="primary"
              size="l"
              onClick={openRedeemModal}
              disabled={!onPendleChain || !isRedeemable || !isPrepared || previewLoading}
              data-testid="pendle-matured-redeem-button"
            >
              <Trans>Claim</Trans>
            </Button>
          </ProductActions>
          {!onPendleChain && (
            <Text variant="small" className="text-fgSecondary" data-testid="pendle-redeem-network-hint">
              <Trans>Redemption happens on Ethereum mainnet. Switch networks to claim.</Trans>
            </Text>
          )}
        </div>
      }
    />
  );
}

export function PendlePositionCard({ market }: { market: PendleMarketConfig }) {
  const { isConnected } = useConnection();

  const { data: ptBalances, mutate: mutateBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;

  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  const expirySec = stats?.expirySec ?? market.expiry;
  const remainingDays = Math.max(
    0,
    Math.floor((expirySec - Math.floor(Date.now() / 1000)) / SECONDS_PER_DAY)
  );
  const claimDateLabel = formatMaturity(expirySec);

  const refresh = useCallback(() => {
    mutateBalances();
  }, [mutateBalances]);

  const { openSupply, openWithdraw } = usePendleModal({ onSuccess: refresh });

  // Hold the card slot until the position read resolves — deciding on the 0n
  // fallback flashes the supply pitch at users who hold a position.
  if (isConnected && ptBalances === undefined) {
    return <PositionCardSkeleton testId="pendle-position-card-skeleton" />;
  }

  // A matured market keeps its detail page (2193:73881): holders get the claim
  // card, everyone else the supply pitch — which the market's own gating keeps
  // inert, since matured markets are filtered out of every supply entry point.
  if (isMarketMatured(expirySec) && ptBalance > 0n) {
    return <PendleMaturedCard market={market} ptBalance={ptBalance} maturityLabel={claimDateLabel} />;
  }

  if (ptBalance === 0n) {
    return (
      <PendleSupplyCard
        market={market}
        fixedApy={stats?.impliedApy}
        remainingDays={remainingDays}
        onSupply={() => openSupply(market)}
      />
    );
  }

  // PT decimals match the underlying's (Pendle convention).
  const positionValue = parseFloat(formatUnits(ptBalance, market.underlyingDecimals));
  // At maturity 1 PT redeems 1 USDS on pegged markets — the claimable amount.
  // The comp (859:41055) tags the figure with a token mark instead of spelling
  // the symbol out, so only the number is formatted here.
  const claimAmount = formatNumber(positionValue, { maxDecimals: 2 });
  const claimSymbol = market.usdsEquivalence === 'pegged' ? 'USDS' : market.underlyingSymbol;

  const fixedRate = stats?.impliedApy !== undefined ? formatDecimalPercentage(stats.impliedApy) : NO_VALUE;

  return (
    <ProductPositionCard
      data-testid="pendle-position-card"
      hero={
        <PositionHero
          pillSymbol={`PT-${market.underlyingSymbol}`}
          balanceSymbol={`PT-${market.underlyingSymbol}`}
          amount={positionValue}
        />
      }
      stats={
        <>
          <ProductStatPair grow>
            {/* No cost-basis source for active positions yet — placeholder per
                the redesign (matches the vault card's already-earned gap). */}
            <ProductStat label={<Trans>Accrued to date</Trans>}>
              <span className="text-fgSecondary">{NO_VALUE}</span>
            </ProductStat>
            <ProductStat label={<Trans>You&apos;ll claim</Trans>}>
              <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
              {claimAmount}
              <TokenIcon
                token={{ symbol: claimSymbol }}
                width={12}
                showChainIcon={false}
                className="h-3 w-3 shrink-0"
              />
            </ProductStat>
          </ProductStatPair>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Claim date</Trans>}>{claimDateLabel}</ProductStat>
            <ProductStat label={<Trans>Fixed rate</Trans>}>
              <ProductPercent value={fixedRate} />
            </ProductStat>
          </ProductStatPair>
        </>
      }
      actions={
        <ProductActions>
          <Button
            variant="primary"
            size="l"
            onClick={() => openSupply(market)}
            disabled={!isConnected}
            data-testid="pendle-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            size="l"
            onClick={() => openWithdraw(market)}
            disabled={!isConnected}
            data-testid="pendle-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </ProductActions>
      }
    />
  );
}
