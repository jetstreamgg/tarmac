import { ReactNode, useCallback } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { mainnet } from 'viem/chains';
import { formatUnits } from 'viem';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import {
  TOKENS,
  usePendleMarketsApiData,
  usePendleUserPtBalances,
  useTokenBalance,
  type PendleMarketConfig
} from '@/hooks';
import { formatDecimalPercentage, formatNumber, splitAmount, isTestnetId } from '@/utils';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { usePendleModal } from '../hooks/usePendleModal';

const NO_VALUE = '–';
const SECONDS_PER_DAY = 86_400;

function StatRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

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

  return (
    <div
      className="bg-panel flex flex-col gap-6 rounded-[20px] p-6 backdrop-blur-2xl"
      data-testid="pendle-supply-card"
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
          /{' '}
          <span className="whitespace-nowrap">
            <TokenIcon
              token={{ symbol: 'USDC' }}
              width={24}
              showChainIcon={false}
              className="mr-1 inline-block h-6 w-6 -translate-y-0.5 align-middle"
            />
            USDC
          </span>{' '}
          and earn {rate} APY
        </Trans>
      </h3>

      <p className="text-textSecondary text-sm leading-relaxed">
        <Trans>
          Fixed yield markets let you supply USDS and walk away with a guaranteed return at the market
          maturity. Fix your yield at {rate} APY for the next {remainingDays} days.
        </Trans>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Current Rate</Trans>
          </span>
          <span className="text-text flex items-center gap-1.5 font-medium">
            {rate}
            <TokenIcon
              token={{ symbol: `PT-${market.underlyingSymbol}` }}
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
        onClick={onSupply}
        disabled={!isConnected}
        data-testid="pendle-supply-cta"
      >
        <Trans>Supply</Trans>
      </Button>
    </div>
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
 * Matured markets never reach this card — the route + PendlePanes bounce them
 * to the overview, where redemption lives (maturity gating unchanged).
 */
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
  const claimDateLabel = format(new Date(expirySec * 1000), 'd MMM yyyy');

  const refresh = useCallback(() => {
    mutateBalances();
  }, [mutateBalances]);

  const { openSupply, openWithdraw } = usePendleModal({ market, onSuccess: refresh });

  if (ptBalance === 0n) {
    return (
      <PendleSupplyCard
        market={market}
        fixedApy={stats?.impliedApy}
        remainingDays={remainingDays}
        onSupply={openSupply}
      />
    );
  }

  // PT decimals match the underlying's (Pendle convention).
  const positionValue = parseFloat(formatUnits(ptBalance, market.underlyingDecimals));
  const { whole, fraction } = splitAmount(positionValue);
  // At maturity 1 PT redeems 1 USDS on pegged markets — the claimable amount.
  const claimAmount =
    market.usdsEquivalence === 'pegged'
      ? `${formatNumber(positionValue, { maxDecimals: 2 })} USDS`
      : `${formatNumber(positionValue, { maxDecimals: 2 })} ${market.underlyingSymbol}`;

  return (
    <div
      className="bg-panel flex flex-col gap-5 rounded-[20px] p-2 backdrop-blur-2xl"
      data-testid="pendle-position-card"
    >
      {/* Hero — "My position" pill + PT balance over a soft brand-tinted inset. */}
      <div className="flex flex-col gap-6 rounded-2xl bg-[radial-gradient(130%_130%_at_15%_0%,_rgba(126,107,242,0.22)_0%,_rgba(58,46,125,0.1)_55%,_transparent_100%)] p-5">
        <span className="bg-surface text-textSecondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm">
          <TokenIcon
            token={{ symbol: `PT-${market.underlyingSymbol}` }}
            width={16}
            showChainIcon={false}
            className="h-4 w-4"
          />
          <Trans>My position</Trans>
        </span>
        <span className="text-text flex items-end gap-2 font-semibold">
          <TokenIcon
            token={{ symbol: `PT-${market.underlyingSymbol}` }}
            width={32}
            showChainIcon={false}
            className="mb-1 h-8 w-8"
          />
          <span className="text-4xl leading-none">{whole}</span>
          {fraction && <span className="text-textSecondary text-2xl leading-tight">.{fraction}</span>}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-3 pb-3">
        <div className="flex flex-col gap-3">
          {/* No cost-basis source for active positions yet — placeholder per the
              redesign (matches the vault card's earned-interest gap). */}
          <StatRow label={<Trans>Current earnings</Trans>}>
            <span className="text-textSecondary">{NO_VALUE}</span>
          </StatRow>
          <StatRow label={<Trans>You&apos;ll claim</Trans>}>
            <TokenIcon token={{ symbol: 'USDS' }} width={18} showChainIcon={false} className="h-4.5 w-4.5" />
            {claimAmount}
          </StatRow>
          <StatRow label={<Trans>Claim date</Trans>}>{claimDateLabel}</StatRow>
          <StatRow label={<Trans>Fixed APY</Trans>}>
            {stats?.impliedApy !== undefined ? formatDecimalPercentage(stats.impliedApy) : NO_VALUE}
          </StatRow>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            className="w-full"
            onClick={openSupply}
            disabled={!isConnected}
            data-testid="pendle-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={openWithdraw}
            disabled={!isConnected}
            data-testid="pendle-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
