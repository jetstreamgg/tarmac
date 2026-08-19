import { useChainId, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { useOverallSkyData, useTokenBalances, type TokenItem } from '@/hooks';
import { formatDecimalPercentage, formatNumber, isL2ChainId } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  NO_VALUE,
  ProductBadge,
  ProductFigure,
  ProductStat,
  ProductStatPair,
  ProductSupplyCard
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { Usds } from '@/modules/icons';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import {
  ORIGIN_TOKENS,
  MAINNET_SUPPLY_ORIGINS,
  L2_SUPPLY_ORIGINS,
  type OriginSymbol
} from './SavingsOriginSelect';

/**
 * No-position Savings entry card (Figma: undeposited state). Shown when the user
 * holds no savings position: an informational card — a "Supply USDS / USDC and
 * earn X% APY" headline over the chain-aware supply tokens, the about blurb, a
 * Current Rate / Idle balance stat row, and a full-width Supply CTA.
 *
 * There is no inline amount input anymore: the CTA opens the shared editable modal
 * (`SavingsModalForm` via `useSavingsModal`, wired by the parent and handed in as
 * `onSupply`) where the amount/token are entered — so all input lives in the modal.
 */
export function SavingsSupplyCard({ onSupply }: { onSupply: () => void }) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();

  // The CTA stays enabled while disconnected: clicking routes through the
  // connect flow and continues into the supply modal once connected.
  const onSupplyOrConnect = useConnectThenAct(onSupply, 'savings_supply');

  // The supply tokens this card advertises = the same chain-aware origins the
  // supply modal offers (USDS/DAI on mainnet, USDS/USDC on L2). Drives both the
  // headline icons and the idle-balance aggregation, so the card reflects exactly
  // what can be deposited on the active chain.
  const origins: OriginSymbol[] = isL2ChainId(chainId) ? L2_SUPPLY_ORIGINS : MAINNET_SUPPLY_ORIGINS;

  const { data: overall } = useOverallSkyData();
  const rate = overall?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overall.skySavingsRatecRate))
    : NO_VALUE;

  // Idle balance = the wallet balances of the supply origins on the active chain.
  // They're all $1-pegged stablecoins, so the summed token amount is the USD figure
  // (same convention the supply surfaces use for USDS/DAI/USDC).
  const originTokens: TokenItem[] = origins
    .map(symbol => ({ address: ORIGIN_TOKENS[symbol].address[chainId], symbol }))
    .filter(token => !!token.address);
  const { data: balances } = useTokenBalances({
    address,
    chainTokenMap: { [chainId]: originTokens },
    enabled: isConnected
  });
  const idleBalance = isConnected
    ? formatNumber(
        (balances ?? []).reduce((sum, balance) => sum + parseFloat(balance.formatted), 0),
        { maxDecimals: 2 }
      )
    : NO_VALUE;

  // Built outside <Trans> so the dynamic token list is a single message placeholder
  // (Lingui can't extract a .map() inside the macro). Rendered as inline text — the
  // symbol labels stay on the title's baseline, only the icons are middle-aligned —
  // so the cluster lines up with the surrounding "Supply … and earn" copy.
  const supplyTokens = (
    <span>
      {origins.map((symbol, index) => (
        <span key={symbol} className="whitespace-nowrap">
          {index > 0 && <span className="text-text/40"> / </span>}
          <TokenIcon
            token={{ symbol }}
            width={24}
            showChainIcon={false}
            // align-middle centers to the line's x-height; nudge up ~2px so the icon
            // centers on the uppercase symbol's cap-height instead of sitting low.
            className="mr-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6"
          />
          {symbol}
        </span>
      ))}
    </span>
  );

  return (
    <ProductSupplyCard
      data-testid="savings-supply-card"
      badges={
        /* Product badge: monochrome per the current comp (859:35719, APP-432
           item 11) — the fg-tertiary USDS mark replaces the green token logo,
           with the label on fg-secondary. */
        <ProductBadge
          data-testid="savings-supply-badge"
          icon={<Usds boxSize={12} className="text-fgTertiary h-3 w-3" aria-hidden />}
        >
          <Trans>Sky Savings</Trans>
        </ProductBadge>
      }
      title={
        <Trans>
          Supply {supplyTokens} and earn {rate} APY
        </Trans>
      }
      description={
        <Trans>
          Governed by Sky Ecosystem to deliver the best risk-adjusted yield, sUSDS allows you to grow your
          holdings with instant liquidity and zero fees.
        </Trans>
      }
      stats={
        <ProductStatPair>
          <ProductStat size="lg" label={<Trans>Current Rate</Trans>}>
            <ProductFigure value={rate}>
              {rate}
              <TokenIcon
                token={{ symbol: 'sUSDS' }}
                width={16}
                showChainIcon={false}
                className="h-4 w-4 shrink-0"
              />
            </ProductFigure>
          </ProductStat>
          <ProductStat size="lg" label={<Trans>Idle balance</Trans>}>
            <ProductFigure value={idleBalance}>
              {idleBalance}
              <TokenIconStack symbols={origins} size={16} />
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
          data-testid="savings-supply-cta"
        >
          <Trans>Supply</Trans>
        </Button>
      }
    />
  );
}
