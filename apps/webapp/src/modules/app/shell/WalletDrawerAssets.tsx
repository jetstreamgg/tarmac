import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { QueryParams } from '@/lib/constants';
import { ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import { formatDecimalPercentage, formatNumber, formatUsd } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RateBadge } from '@/components/ui/RateBadge';
import { useGeoConfig } from '@/modules/geo-config';
import { useWalletDrawerAssets, type WalletDrawerAsset } from './useWalletDrawerAssets';

/**
 * The drawer's Assets tab: a row per drawer token (zero balances included)
 * with the best earn rate as a badge and a hover-revealed "Start earning" CTA
 * that deep-links into the Earn list (or Stake for SKY). Region-restricted
 * visitors get plain balances — no rates, no CTAs.
 */
export function WalletDrawerAssets() {
  const navigate = useNavigate();
  const { assets, isLoading } = useWalletDrawerAssets();
  const { isRegionRestricted } = useGeoConfig();

  // Deep-link to the Earn list pre-filtered by the chosen token (keeps the
  // active network), consumed by EarnPage's ?token= handler. SKY earns
  // through staking, so it routes to Stake instead.
  const onStartEarning = (symbol: string) => {
    if (symbol === 'SKY') {
      void navigate({ to: ROUTES.STAKE, search: retainOnNavigate });
    } else {
      void navigate({
        to: ROUTES.EARN,
        search: prev => ({ ...retainOnNavigate(prev), [QueryParams.Token]: symbol })
      });
    }
  };

  if (isLoading && assets.every(asset => asset.amountUsd === 0)) {
    return (
      <div className="flex flex-col gap-2 px-2 py-3 md:p-4" data-testid="wallet-drawer-assets">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="wallet-drawer-assets">
      {assets.map(asset => (
        <AssetRow
          key={asset.symbol}
          asset={asset}
          showEarnActions={!isRegionRestricted}
          onStartEarning={() => onStartEarning(asset.symbol)}
        />
      ))}
    </div>
  );
}

function AssetRow({
  asset,
  showEarnActions,
  onStartEarning
}: {
  asset: WalletDrawerAsset;
  showEarnActions: boolean;
  onStartEarning: () => void;
}) {
  return (
    <div
      className="group focus-within:bg-glassSurface hover:bg-glassSurface rounded-2xl px-2 py-3 transition-colors md:p-4"
      data-testid={`wallet-drawer-asset-${asset.symbol.toLowerCase()}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="border-borderTertiary flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px]">
            <TokenIcon token={{ symbol: asset.symbol }} width={28} showChainIcon={false} className="size-7" />
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Text
                tag="span"
                className="font-circle text-text text-base leading-[18px] tracking-tight md:text-lg md:leading-[22px]"
              >
                {asset.symbol}
              </Text>
              {showEarnActions && asset.bestRate !== undefined && asset.bestRate > 0 && (
                <RateBadge>
                  {asset.multipleVenues ? (
                    <Trans>up to {formatDecimalPercentage(asset.bestRate)}</Trans>
                  ) : (
                    formatDecimalPercentage(asset.bestRate)
                  )}
                </RateBadge>
              )}
            </div>
            <Text
              tag="span"
              variant="captionSm"
              className="text-textSecondary text-[11px] leading-4 md:text-xs"
            >
              {asset.name}
            </Text>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Text
            tag="span"
            className="font-circle text-text text-base leading-[18px] tracking-tight md:text-lg md:leading-[22px]"
          >
            {formatNumber(asset.amount)}
          </Text>
          <Text
            tag="span"
            variant="captionSm"
            className="text-textSecondary text-[11px] leading-4 md:text-xs"
          >
            {formatUsd(asset.amountUsd)}
          </Text>
        </div>
      </div>
      {showEarnActions && (
        <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100 group-hover:grid-rows-[1fr] group-hover:opacity-100">
          <div className="overflow-hidden">
            <Button
              variant="primary"
              size="m"
              className="mt-4 w-full"
              onClick={onStartEarning}
              data-testid={`wallet-drawer-earn-${asset.symbol.toLowerCase()}`}
            >
              <Trans>Start earning</Trans>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
