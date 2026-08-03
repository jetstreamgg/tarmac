import { useCallback } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { useSavingsData, useTokenBalance, useOverallSkyData, TOKENS } from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { PositionHero } from '@/components/product/PositionHero';
import {
  NO_VALUE,
  ProductActions,
  ProductFigure,
  ProductPercent,
  ProductPositionCard,
  ProductStat,
  ProductStatPair
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSavingsModal } from '../hooks/useSavingsModal';
import { useSavingsAccrualRate } from '../hooks/useSavingsAccrualRate';
import { SavingsSupplyCard } from './SavingsSupplyCard';

const formatToken = (value?: bigint) =>
  value === undefined ? NO_VALUE : formatNumber(parseFloat(formatUnits(value, 18)), { maxDecimals: 2 });

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
  // sUSDS appreciates every second; the hero figure shows it happening.
  const ratePerSecond = useSavingsAccrualRate();
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
    <ProductPositionCard
      data-testid="savings-position-card"
      hero={
        <PositionHero
          pillSymbol="sUSDS"
          balanceSymbol="USDS"
          amount={positionValue}
          ratePerSecond={ratePerSecond}
        />
      }
      stats={
        <>
          <ProductStatPair grow>
            {/* No cost-basis source yet → dash (PRD: unavailable values read "–"). */}
            <ProductStat label={<Trans>Already earned</Trans>}>
              <span className="text-fgSecondary">{NO_VALUE}</span>
            </ProductStat>
            <ProductStat label={<Trans>Est. earnings (1Y)</Trans>}>
              <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
              {formatNumber(projectedEarnings, { maxDecimals: 2 })}
              <TokenIcon
                token={{ symbol: 'USDS' }}
                width={12}
                showChainIcon={false}
                className="h-3 w-3 shrink-0"
              />
            </ProductStat>
          </ProductStatPair>
          <ProductStatPair grow>
            <ProductStat label={<Trans>sUSDS balance</Trans>}>
              <ProductFigure value={susds}>
                <TokenIcon
                  token={{ symbol: 'sUSDS' }}
                  width={12}
                  showChainIcon={false}
                  className="h-3 w-3 shrink-0"
                />
                {susds}
              </ProductFigure>
            </ProductStat>
            <ProductStat label={<Trans>Current rate</Trans>}>
              <ProductPercent value={currentRate} />
            </ProductStat>
          </ProductStatPair>
        </>
      }
      actions={
        /* Supply / Withdraw each open the editable modal for their flow. */
        <ProductActions>
          <Button
            variant="primary"
            size="l"
            onClick={() => openSupply()}
            disabled={!isConnected}
            data-testid="savings-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            size="l"
            onClick={() => openWithdraw()}
            disabled={!isConnected}
            data-testid="savings-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </ProductActions>
      }
    />
  );
}
