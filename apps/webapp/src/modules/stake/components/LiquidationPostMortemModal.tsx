import { ReactNode, useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ExternalLink, X } from 'lucide-react';
import {
  getIlkName,
  usePrices,
  useRewardContractsToClaim,
  useSkyPrice,
  useStakeRewardContracts,
  useStakeUrnAddress,
  useStakeUrnSelectedVoteDelegate,
  useVault,
  ZERO_ADDRESS
} from '@/hooks';
import { formatUsd, getEtherscanLink } from '@/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { invalidateStakeQueries } from '../lib/invalidateStakeQueries';
import { useStakeManageLaunch } from '../hooks/useStakeManageLaunch';
import { lastStakeUrnBark, useStakeUserPositions } from '../hooks/useStakeUserPositions';

const NO_VALUE = '–';

function StatCell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text font-circle flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

/**
 * UTC timestamp used for the "Liquidated on" heading — the bark is a
 * blockchain fact, so the display anchors to UTC rather than the viewer's
 * local zone (no existing formatDate helper does this; `date-fns` has no
 * UTC-locked shape either, so this stays a small local formatter).
 */
function formatLiquidatedOn(blockTimestamp: number): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(new Date(blockTimestamp * 1000));
  return `${formatted} UTC`;
}

interface RecoveryClaim {
  contractAddress: `0x${string}`;
  symbol: string;
  amount: bigint;
  amountUsd: number;
}

/**
 * Recovery review-screen body (bundled Withdraw SKY + per-reward Claim legs):
 * one amount hero per leg, mirroring `StakeManageConfirmSummary`'s hero shape.
 */
function LiquidationRecoveryConfirmSummary({
  skyToFree,
  skyAmountUsd,
  claims
}: {
  skyToFree: bigint;
  skyAmountUsd: number | null;
  claims: RecoveryClaim[];
}) {
  return (
    <div data-testid="stake-postmortem-recovery-summary" className="flex flex-col gap-5">
      {skyToFree > 0n && (
        <div className="flex flex-col gap-1" data-testid="stake-postmortem-summary-withdraw">
          <span className="text-textSecondary text-sm">
            <Trans>Withdraw amount</Trans>
          </span>
          <span className="text-text font-circle flex items-center gap-2 text-2xl font-medium tracking-tight">
            <TokenIcon token={{ symbol: 'SKY' }} width={28} className="h-7 w-7" showChainIcon={false} />
            {formatStakeAmount(skyToFree)} SKY
          </span>
          {skyAmountUsd !== null && (
            <span className="text-textSecondary text-xs">{formatUsd(skyAmountUsd)}</span>
          )}
        </div>
      )}
      {claims.map(claim => (
        <div
          key={claim.contractAddress}
          className="flex flex-col gap-1"
          data-testid={`stake-postmortem-summary-claim-${claim.symbol.toLowerCase()}`}
        >
          <span className="text-textSecondary text-sm">
            <Trans>Rewards amount ({claim.symbol})</Trans>
          </span>
          <span className="text-text font-circle flex items-center gap-2 text-2xl font-medium tracking-tight">
            <TokenIcon
              token={{ symbol: claim.symbol }}
              width={28}
              className="h-7 w-7"
              showChainIcon={false}
            />
            {formatStakeAmount(claim.amount)} {claim.symbol}
          </span>
          <span className="text-textSecondary text-xs">{formatUsd(claim.amountUsd)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Liquidation post-mortem: replaces the position-details modal once an
 * urn has been barked and nothing has mutated it since
 * (`isLiquidatedStakePosition`). Read-only history on the left, a bundled
 * recovery (withdraw the SKY refund + claim every outstanding reward in one
 * Confirm) on the right — the same manage-flow seam every other stake surface
 * uses, so the recovery tx is indistinguishable from a manual withdraw+claim.
 *
 * Historical auction detail (what SKY sold for, debt repaid, chop applied) is
 * NOT indexed against the bark yet, so those stats render the same NO_VALUE
 * gap as every other undesigned/ungated stat on the sibling details modal.
 */
export function LiquidationPostMortemModal({ urnIndex, onClose }: { urnIndex: number; onClose: () => void }) {
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const { data: positions } = useStakeUserPositions();
  const position = positions?.find(p => p.index === urnIndex);
  const lastBark = position ? lastStakeUrnBark(position) : undefined;

  const { data: urnAddress } = useStakeUrnAddress(BigInt(urnIndex));
  const { data: vault, isLoading: vaultLoading } = useVault(urnAddress || ZERO_ADDRESS, getIlkName(2));
  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: urnAddress || ZERO_ADDRESS
  });

  const { data: rewardContracts } = useStakeRewardContracts();
  const { data: toClaim, isLoading: claimableLoading } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddress ? [urnAddress] : [],
    chainId,
    enabled: Boolean(urnAddress && rewardContracts?.length)
  });
  const { data: prices } = usePrices();
  const { priceString: skyPriceString } = useSkyPrice();
  const skyPriceUsd = skyPriceString ? parseFloat(skyPriceString) : null;

  const claims = useMemo<RecoveryClaim[]>(() => {
    return (toClaim ?? [])
      .filter(reward => reward.claimBalance > 0n)
      .map(reward => {
        const price = parseFloat(prices?.[reward.rewardSymbol]?.price ?? '0');
        return {
          contractAddress: reward.contractAddress,
          symbol: reward.rewardSymbol,
          amount: reward.claimBalance,
          amountUsd: Number(formatUnits(reward.claimBalance, 18)) * price
        };
      });
  }, [toClaim, prices]);

  const claimableUsd = claims.reduce((total, claim) => total + claim.amountUsd, 0);
  const rewardContractsToClaim = useMemo(() => claims.map(claim => claim.contractAddress), [claims]);
  const claimSymbols = useMemo(() => claims.map(claim => claim.symbol), [claims]);

  const skyToFree = vault?.collateralAmount ?? 0n;
  const skyToFreeUsd = skyPriceUsd !== null ? Number(formatUnits(skyToFree, 18)) * skyPriceUsd : null;
  const hasRecovery = skyToFree > 0n || claims.length > 0;

  const onSuccess = useCallback(() => {
    // Same invalidation set as every other manage-flow success path — the
    // recovery tx changes positions, history and every on-chain read alike.
    invalidateStakeQueries(queryClient);
  }, [queryClient]);

  const transactionContent = useMemo(
    () => (
      <LiquidationRecoveryConfirmSummary skyToFree={skyToFree} skyAmountUsd={skyToFreeUsd} claims={claims} />
    ),
    [skyToFree, skyToFreeUsd, claims]
  );

  const recovery = useStakeManageLaunch({
    urnIndex: BigInt(urnIndex),
    urnAddress,
    skyToLock: 0n,
    skyToFree,
    usdsToBorrow: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    // Passed through unchanged, same idiom as ManagePositionTakeover/
    // OpenPositionTakeover, so needsDelegateUpdate never fires for a recovery.
    selectedDelegate: urnSelectedVoteDelegate,
    enabled: hasRecovery,
    rewardContractsToClaim,
    claimSymbols,
    transactionContent,
    onSuccess
  });

  const ctaDisabled = !recovery.prepared || recovery.isLoading || !hasRecovery;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        data-testid="stake-postmortem-modal"
        className="bg-containerDark flex max-h-[90vh] w-full flex-col gap-0 overflow-y-auto p-0 sm:min-w-0 lg:max-w-[1042px] lg:flex-row"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        {/* Left panel — refunded/claimable heroes + the historical stat grid. */}
        <div className="flex flex-1 flex-col gap-6 p-8">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-text font-circle flex items-center gap-2 text-lg font-medium">
              <Trans>Position {urnIndex + 1}</Trans>
              <span
                data-testid="stake-postmortem-liquidated-chip"
                className="bg-error/15 text-error font-circle rounded-full px-2 py-0.5 text-xs font-medium"
              >
                <Trans>Liquidated</Trans>
              </span>
            </DialogTitle>
            <Button
              variant="secondary"
              size="iconM"
              onClick={onClose}
              aria-label={t`Close`}
              data-testid="stake-postmortem-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5" data-testid="stake-postmortem-refunded-sky">
              <span className="text-textSecondary text-sm">
                <Trans>Refunded SKY</Trans>
              </span>
              {vaultLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <span className="text-text font-circle flex items-baseline gap-2 text-3xl font-medium tracking-tight">
                  <TokenIcon
                    token={{ symbol: 'SKY' }}
                    width={28}
                    className="h-7 w-7 self-center"
                    showChainIcon={false}
                  />
                  {formatStakeAmount(skyToFree)}
                </span>
              )}
              {!vaultLoading && (
                <span className="text-textSecondary text-xs">
                  {skyToFreeUsd !== null ? formatUsd(skyToFreeUsd) : NO_VALUE}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5" data-testid="stake-postmortem-claimable-rewards">
              <span className="text-textSecondary text-sm">
                <Trans>Claimable rewards</Trans>
              </span>
              {claimableLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : claims.length === 0 ? (
                <span className="text-text font-circle text-3xl font-medium tracking-tight">{NO_VALUE}</span>
              ) : claims.length === 1 ? (
                <>
                  <span className="text-text font-circle flex items-baseline gap-2 text-3xl font-medium tracking-tight">
                    <TokenIcon
                      token={{ symbol: claims[0].symbol }}
                      width={28}
                      className="h-7 w-7 self-center"
                      showChainIcon={false}
                    />
                    {formatStakeAmount(claims[0].amount)}
                  </span>
                  <span className="text-textSecondary text-xs">{formatUsd(claims[0].amountUsd)}</span>
                </>
              ) : (
                <>
                  <span className="text-text font-circle flex items-center gap-2 text-3xl font-medium tracking-tight">
                    {formatUsd(claimableUsd)}
                    <IconStack size={20}>
                      {claims.map(claim => (
                        <TokenIcon
                          key={claim.contractAddress}
                          token={{ symbol: claim.symbol }}
                          width={20}
                          className="h-full w-full"
                          showChainIcon={false}
                        />
                      ))}
                    </IconStack>
                  </span>
                  <span className="text-textSecondary text-xs">
                    ({claims.map(claim => claim.symbol).join(', ')})
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="border-textSecondary/10 grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-4 sm:grid-cols-3">
            <StatCell label={<Trans>Collateral before liquidation</Trans>}>
              {lastBark ? `${formatStakeAmount(lastBark.ink)} SKY` : NO_VALUE}
            </StatCell>
            {/* Neither leg is attributable to a specific bark in the indexer yet. */}
            <StatCell label={<Trans>SKY sold</Trans>}>{NO_VALUE}</StatCell>
            <StatCell label={<Trans>Debt repaid</Trans>}>{NO_VALUE}</StatCell>
            {/* Historical chop at bark time isn't indexed either. */}
            <StatCell label={<Trans>Liquidation penalty (13%)</Trans>}>{NO_VALUE}</StatCell>
            <StatCell label={<Trans>Delegated votes</Trans>}>
              <Trans>Released</Trans>
            </StatCell>
          </div>
        </div>

        {/* Right rail — historical context + the bundled recovery CTA. */}
        <div className="bg-surfaceAlt/30 flex w-full flex-col justify-between gap-6 p-8 lg:w-[340px]">
          <div className="flex flex-col gap-4">
            <h3
              className="text-text font-circle text-lg font-medium"
              data-testid="stake-postmortem-liquidated-on"
            >
              {!lastBark ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <Trans>Liquidated on {formatLiquidatedOn(lastBark.blockTimestamp)}</Trans>
              )}
            </h3>
            <p className="text-textSecondary text-sm">
              <Trans>
                SKY fell below your liquidation price, triggering liquidation. Your debt was repaid from
                collateral and any leftover SKY was refunded to the position.
              </Trans>
            </p>
            {lastBark && (
              <a
                href={getEtherscanLink(chainId, lastBark.transactionHash, 'tx')}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="stake-postmortem-explorer-link"
                className="text-textSecondary hover:text-text flex w-fit items-center gap-1 text-sm transition-colors"
              >
                <Trans>View on block explorer</Trans>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>

          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={() => recovery.launch()}
            disabled={ctaDisabled}
            data-testid="stake-postmortem-claim-cta"
          >
            <Trans>Claim rewards &amp; withdraw SKY</Trans>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
