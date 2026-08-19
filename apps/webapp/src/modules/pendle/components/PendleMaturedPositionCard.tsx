import { Trans } from '@lingui/react/macro';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBigInt, formatNumber, getChainIcon, getChainName } from '@/utils';
import {
  isPendleChain,
  type PendleMarketConfig,
  usePendleMaturedPositionEarnings,
  usePendleRedeemPreview
} from '@/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconboxStatus } from '@/components/ui/iconbox';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Text } from '@/modules/layout/components/Typography';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';
import { formatMaturity } from '@/modules/earn/helpers/formatMaturity';

// The PositionCard type tokens (486:20195 → 486:20044) — this card sits in the
// same carousel and must match its siblings' rhythm.
const statValue =
  'font-circle text-xs leading-[14px] font-medium tracking-[-0.24px] md:text-sm md:leading-4 md:tracking-[-0.28px]';
const statLabel =
  'font-graphik text-fgSecondary text-[11px] leading-4 font-normal md:text-xs md:leading-[18px]';
const badgeText =
  'font-circle text-[11px] leading-3 font-medium tracking-[-0.22px] md:text-xs md:leading-[14px] md:tracking-[-0.24px]';
const badgePill = 'bg-glassBadge flex items-center gap-1 rounded-[20px] py-1 pr-2 pl-1';

type PendleMaturedPositionCardProps = {
  market: PendleMarketConfig;
  ptBalance: bigint;
};

/**
 * A matured Pendle position in the Portfolio Supplied carousel (Figma
 * 2306:72334): the PositionCard chrome with a "Matured" badge, the
 * ready-to-withdraw summary, My position / Mature date stats and a single
 * Claim CTA opening the redeem modal. Replaces the retired below-Transactions
 * "Your matured positions" section.
 */
export const PendleMaturedPositionCard = ({ market, ptBalance }: PendleMaturedPositionCardProps) => {
  const maturityLabel = formatMaturity(market.expiry);

  // DEMO BRANCH — DO NOT MERGE: the on-chain preview can't resolve for a
  // not-actually-matured market, so bypass it (PT balance ≈ receive amount).
  usePendleRedeemPreview(market, ptBalance);
  const previewAmount: bigint | undefined = ptBalance;
  const previewLoading = false;
  const { earnings, currency } = usePendleMaturedPositionEarnings(market, ptBalance);
  // The amount we surface is the receive amount (post SY-rate conversion).
  // Until the on-chain preview resolves, fall back to the PT balance — same
  // number of decimals, just a transient discrepancy.
  const displayedAmount = formatBigInt((previewAmount as bigint | undefined) ?? ptBalance, {
    unit: market.underlyingDecimals,
    maxDecimals: 2
  });

  const { openRedeemModal, isRedeemable, isPrepared } = usePendleRedeemModal(market);

  // Redemption signs on mainnet; the portfolio has already prompted a network
  // switch (usePendleMaturedPositions), so a still-mismatched chain means the
  // user declined — keep the card visible but the action disabled instead of
  // letting the confirm fail with a wallet chain-mismatch error.
  const onPendleChain = isPendleChain(useChainId());

  return (
    <Card
      className="flex h-full flex-col gap-7 p-5 md:gap-10 md:px-8 md:py-7"
      data-testid="pendle-matured-position-card"
    >
      <div className="flex items-start justify-between">
        <IconboxStatus size="l" type="success" dot>
          <TokenIcon
            token={{ symbol: market.underlyingSymbol }}
            width={48}
            showChainIcon={false}
            className="h-12 w-12"
          />
        </IconboxStatus>
        <div className="flex items-center gap-1.5">
          <span className={cn(badgePill, 'pl-2')} data-testid="pendle-matured-badge">
            <Clock className="text-statusWarning size-3 shrink-0" aria-hidden />
            <span className={cn(badgeText, 'text-statusWarning')}>
              <Trans>Matured</Trans>
            </span>
          </span>
          <span className={badgePill}>
            <span className="flex h-4 w-4 shrink-0">{getChainIcon(mainnet.id, 'h-full w-full')}</span>
            <span className={cn(badgeText, 'text-fgPrimary')}>{getChainName(mainnet.id)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-fgPrimary font-circle text-xl leading-[22px] font-medium tracking-[-0.4px] md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
          Pendle {market.underlyingSymbol}
        </span>
        <Text variant="small" className="text-fgSecondary">
          {earnings !== undefined && earnings > 0 && currency ? (
            <Trans>
              Matured on {maturityLabel}. Your deposit and {formatNumber(earnings)} {currency} in yield are
              ready to withdraw.
            </Trans>
          ) : (
            <Trans>Matured on {maturityLabel}. Your deposit is ready to withdraw.</Trans>
          )}
        </Text>
      </div>

      <div className="flex">
        <div className="flex w-[140px] flex-col gap-1">
          <span className={statLabel}>
            <Trans>My position</Trans>
          </span>
          {previewLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className={cn(statValue, 'text-fgPrimary flex items-center gap-1')}>
              <TokenIcon
                token={{ symbol: market.underlyingSymbol }}
                width={12}
                showChainIcon={false}
                className="size-3 shrink-0"
              />
              {displayedAmount}
            </span>
          )}
        </div>
        <div className="bg-border mx-5 h-[29.5px] w-px shrink-0 self-center" />
        <div className="flex flex-1 flex-col gap-1">
          <span className={statLabel}>
            <Trans>Mature date</Trans>
          </span>
          <span className={cn(statValue, 'text-fgPrimary')}>{maturityLabel}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button
          variant="primary"
          size="l"
          className="w-full"
          onClick={openRedeemModal}
          disabled={!onPendleChain || !isRedeemable || !isPrepared || previewLoading}
          data-testid="pendle-matured-redeem-button"
        >
          <Trans>Claim</Trans>
        </Button>
        {!onPendleChain && (
          <Text variant="small" className="text-fgSecondary" data-testid="pendle-redeem-network-hint">
            <Trans>Redemption happens on Ethereum mainnet. Switch networks to claim.</Trans>
          </Text>
        )}
      </div>
    </Card>
  );
};
