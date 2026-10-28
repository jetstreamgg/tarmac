import { Trans } from '@lingui/react/macro';
import { useChainId } from 'wagmi';
import { Clock } from 'lucide-react';
import { formatUnits } from 'viem';
import { cn } from '@/lib/cn';
import { familyMainnetId, formatNumber, getChainIcon, getChainName } from '@/utils';
import type { PendleMarketConfig } from '@/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconboxStatus } from '@/components/ui/iconbox';
import { EarningsFigureValue } from '@/modules/portfolio/components/EarningsStat';
import type { PositionEarnings } from '@/modules/portfolio/earnings/earningsForPosition';
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
  /** The same earnings slice the detail page's Accrued to date reads. */
  accrued: PositionEarnings | null;
  /** Routes to the market's detail page — the siblings' "Manage" slot. */
  onViewDetails: () => void;
};

/**
 * A matured Pendle position in the Portfolio Supplied carousel (Figma
 * 2306:72334): the PositionCard chrome with a "Matured" badge, the
 * ready-to-claim line, You'll claim / Accrued to date stats and a Claim CTA
 * opening the redeem modal. The figures match the detail page's matured card.
 */
export const PendleMaturedPositionCard = ({
  market,
  ptBalance,
  accrued,
  onViewDetails
}: PendleMaturedPositionCardProps) => {
  const maturityLabel = formatMaturity(market.expiry);

  // 1 PT redeems 1 USDS on pegged markets. A non-pegged market redeems through
  // the SY rate, so 1 PT is not 1 underlying: give this a real quote before
  // adding one.
  const claimAmount = formatNumber(parseFloat(formatUnits(ptBalance, market.underlyingDecimals)), {
    maxDecimals: 2
  });
  const claimSymbol = market.usdsEquivalence === 'pegged' ? 'USDS' : market.underlyingSymbol;

  // Off-chain, Claim stays enabled: the click switches the wallet first, then
  // opens (usePendleRedeemModal) — so isPrepared only gates on the right chain.
  // A Safe can't be switched from the dapp, so its off-chain Claim disables
  // with the hint below instead (APP-486).
  const { openRedeemModal, isRedeemable, isPrepared, onPendleChain, switchBlocked } =
    usePendleRedeemModal(market);
  // Where the claim executes — matches the redeem modal's Network cell (the
  // fork in dev sessions, mainnet otherwise).
  const engineChainId = familyMainnetId(useChainId());

  return (
    <Card
      className="flex h-full flex-col gap-7 p-5 md:gap-10 md:px-8 md:py-7"
      data-testid="pendle-matured-position-card"
    >
      <div className="flex items-start justify-between">
        <IconboxStatus size="l" type="success">
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
            <span className="flex h-4 w-4 shrink-0">{getChainIcon(engineChainId, 'h-full w-full')}</span>
            <span className={cn(badgeText, 'text-fgPrimary')}>{getChainName(engineChainId)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-fgPrimary font-circle text-xl leading-[22px] font-medium tracking-[-0.4px] md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
          {market.name}
        </span>
        <Text variant="small" className="text-fgSecondary">
          <Trans>Your position matured on {maturityLabel} and is ready to claim.</Trans>
        </Text>
      </div>

      <div className="flex">
        <div className="flex w-[140px] flex-col gap-1">
          <span className={statLabel}>
            <Trans>You&apos;ll claim</Trans>
          </span>
          <span className={cn(statValue, 'text-fgPrimary flex items-center gap-1')}>
            <TokenIcon
              token={{ symbol: claimSymbol }}
              width={12}
              showChainIcon={false}
              className="size-3 shrink-0"
            />
            {claimAmount}
          </span>
        </div>
        <div className="bg-border mx-5 h-[29.5px] w-px shrink-0 self-center" />
        <div className="flex flex-1 flex-col gap-1">
          <span className={statLabel}>
            <Trans>Accrued to date</Trans>
          </span>
          <EarningsFigureValue
            figure={accrued?.totalEarned ?? null}
            missing={accrued?.missingFromTotal}
            coverage={accrued?.coverage}
            pendleSplit={accrued?.pendleSplit}
            variant="plain"
            className={cn(
              statValue,
              accrued?.totalEarned?.status === 'ok' ? 'text-fgPrimary' : 'text-fgSecondary'
            )}
            skeletonClassName="h-3.5 w-14 rounded"
            testId="pendle-matured-accrued"
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {/* The comp draws Claim alone (2306:72334), from before the matured
            market had a detail page to link to. The secondary restores the
            siblings' shape — every other card on this page offers a route to
            its product page — and reads "View details" rather than "Manage":
            a matured position has nothing left to manage. */}
        <div className="flex gap-3 [&>button]:flex-1">
          <Button
            variant="primary"
            size="l"
            onClick={openRedeemModal}
            disabled={switchBlocked || !isRedeemable || (onPendleChain && !isPrepared)}
            data-testid="pendle-matured-redeem-button"
          >
            <Trans>Claim</Trans>
          </Button>
          <Button
            variant="secondary"
            size="l"
            onClick={onViewDetails}
            data-testid="pendle-matured-view-details"
          >
            <Trans>View details</Trans>
          </Button>
        </div>
        {switchBlocked && (
          <Text variant="small" className="text-fgSecondary" data-testid="pendle-redeem-network-hint">
            <Trans>
              Claiming happens on Ethereum mainnet. Network switching is managed by your Safe app.
            </Trans>
          </Text>
        )}
      </div>
    </Card>
  );
};
