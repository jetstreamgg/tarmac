import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Vault, Droplet, Percent } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import {
  getTokenDecimals,
  type VaultConfig,
  useMorphoVaultChartInfo,
  useMorphoVaultMarketApiData,
  useProductNetworks
} from '@/hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@/utils';
import { Morpho } from '@/widgets';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { HeaderBadge } from '@/components/ui/page-header';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { VaultDetailChart } from './VaultDetailChart';
import { VaultStrategy } from './VaultStrategy';
import { VaultPositionCard } from './VaultPositionCard';
import { VaultTransactionsTable } from './VaultTransactionsTable';
import { VaultRateBreakdown } from './VaultRateBreakdown';
import { trailing30DayRate } from '../helpers/vaultRates';
import { NO_VALUE } from '@/lib/constants';

/**
 * Morpho-vault product-detail page (D4) — composes the reusable
 * ProductDetailTemplate, mirroring SavingsProductDetail. Serves every Morpho
 * vault at /earn/vaults/morpho/:address (USDC Risk Capital is the design proof).
 * `vaultAddress` is resolved for the active chain by the caller (VaultDetailPage).
 */
export function VaultProductDetail({
  vault,
  vaultAddress
}: {
  vault: VaultConfig;
  vaultAddress: `0x${string}`;
}) {
  const chainId = useChainId();
  const networks = useProductNetworks(Intent.VAULTS_INTENT, vault.vaultAddress);

  const { data: marketData } = useMorphoVaultMarketApiData({ vaultAddress });
  // Daily series → trailing 30-day average for the "30D Rate" row (no dedicated
  // endpoint; same approach as the Savings 6M rate). `useHourlyInterval: false`
  // (not the default `undefined`) so the query key matches the chart's daily fetch
  // and TanStack serves both from one request.
  const { data: dailyChart } = useMorphoVaultChartInfo({ vaultAddress, useHourlyInterval: false });

  const decimals = getTokenDecimals(vault.assetToken, chainId);
  const rate = marketData?.rate;
  const thirtyDay = trailing30DayRate(dailyChart ?? []);

  const details: ProductDetailRow[] = [
    {
      id: 'current-rate',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Current Rate</Trans>,
      // Incentive-boosted vaults tag the figure with the DS stars mark and
      // explain it through the breakdown tooltip (APP-443 item 14).
      value: <VaultRateBreakdown rate={rate} value={rate?.formattedNetRate ?? NO_VALUE} />
    },
    {
      id: 'rate-30d',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>30D Rate</Trans>,
      value: thirtyDay !== undefined ? formatDecimalPercentage(thirtyDay) : NO_VALUE
    },
    {
      id: 'tvl',
      icon: <Vault className="h-3 w-3" />,
      label: <Trans>TVL</Trans>,
      value:
        marketData?.totalAssetsUsd !== undefined
          ? `$${formatNumber(marketData.totalAssetsUsd, { maxDecimals: 0 })}`
          : NO_VALUE
    },
    {
      id: 'liquidity',
      icon: <Droplet className="h-3 w-3" />,
      label: <Trans>Liquidity</Trans>,
      value:
        marketData?.liquidity !== undefined
          ? `$${formatBigInt(marketData.liquidity, { unit: decimals, maxDecimals: 0 })}`
          : NO_VALUE
    },
    {
      id: 'management-fee',
      icon: <Percent className="h-3 w-3" />,
      label: <Trans>Management fee</Trans>,
      value: rate?.formattedManagementFee ?? NO_VALUE
    },
    {
      id: 'performance-fee',
      icon: <Percent className="h-3 w-3" />,
      label: <Trans>Performance fee</Trans>,
      value: rate?.formattedPerformanceFee ?? NO_VALUE
    }
  ];

  return (
    <ProductDetailTemplate
      backHref={ROUTES.EARN}
      token={{
        icon: (
          <TokenIcon
            token={{ symbol: vault.assetToken.symbol }}
            width={48}
            className="h-12 w-12"
            showChainIcon={false}
          />
        ),
        status: vault.provider === 'morpho' ? 'info' : undefined
      }}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {vault.name}
          {/* Only Morpho-provided vaults carry the badge — the sUSDT vault runs
              on Spark infra and is not a Morpho product. */}
          {vault.provider === 'morpho' && (
            <HeaderBadge size="s" icon={<Morpho className="size-4 rounded-sm" />}>
              <Trans>Powered by Morpho</Trans>
            </HeaderBadge>
          )}
        </span>
      }
      networkSelector={
        <ChainModal chainIds={networks} labelClassName="hidden sm:block" dataTestId="vault-detail-network" />
      }
      chart={<VaultDetailChart vaultAddress={vaultAddress} assetToken={vault.assetToken} />}
      position={
        <VaultPositionCard
          vaultAddress={vaultAddress}
          assetToken={vault.assetToken}
          vaultName={vault.name}
          provider={vault.provider}
        />
      }
      details={details}
      afterDetails={{ title: <Trans>Strategy</Trans>, body: <VaultStrategy vaultAddress={vaultAddress} /> }}
      // TODO: About copy for the vault.
      about={{ body: 'TODO' }}
      transactions={<VaultTransactionsTable vaultAddress={vaultAddress} />}
    />
  );
}
