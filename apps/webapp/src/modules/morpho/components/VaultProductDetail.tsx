import type { ReactNode } from 'react';
import { useChainId, useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Vault, Droplet, Percent } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import {
  productNetworks,
  useMorphoVaultChartInfo,
  useMorphoVaultMarketApiData,
  getTokenDecimals,
  type VaultConfig
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
import { USER_RISKS_URL } from '@/lib/constants';

const NO_VALUE = '–';

/**
 * About copy per vault (APP-526), keyed by the config name - the one stable,
 * chain-independent identifier a VaultConfig carries. Ticket copy verbatim.
 */
const VAULT_ABOUT: Record<string, ReactNode> = {
  'USDT Savings': (
    <Trans>
      USDT Savings vault accepts USDT deposits and deploys them exclusively into an sUSDS-USDT Morpho market.
      Vault performance is driven by the underlying markets&apos; borrowing demand and is not controlled by
      Sky.money. Instead, it&apos;s adjusted dynamically by the Morpho smart contracts.
    </Trans>
  ),
  'USDS Flagship': (
    <Trans>
      USDS Flagship vault accepts USDS deposits. It keeps 80% in the vault and allocates 20% to 3 markets
      exposed to cbBTC, wstETH and PT-sUSDS. Vault performance is driven by the underlying markets&apos;
      borrowing demand and is not controlled by Sky.money. Instead, it&apos;s adjusted dynamically by the
      Morpho smart contracts. Note stUSDS risks, including SKY price volatility and potential bad debt.
    </Trans>
  ),
  'USDT Risk Capital': (
    <Trans>
      USDT Risk Capital vault accepts USDT deposits and deploys them exclusively into an stUSDS-USDT Morpho
      market. stUSDS is a SKY-backed Vault performance is driven by the underlying markets&apos; borrowing
      demand and is not controlled by Sky.money. Instead, it&apos;s adjusted dynamically by the Morpho smart
      contracts. Note stUSDS risks, including SKY price volatility and potential bad debt.
    </Trans>
  ),
  'USDS Risk Capital': (
    <Trans>
      USDS Risk Capital vault accepts USDS deposits and deploys them exclusively into an stUSDS-USDS Morpho
      market. Vault performance is driven by the underlying markets&apos; borrowing demand and is not
      controlled by Sky.money. Instead, it&apos;s adjusted dynamically by the Morpho smart contracts.
    </Trans>
  ),
  'USDC Risk Capital': (
    <Trans>
      USDC Risk Capital vault accepts USDC deposits and deploys them exclusively into an stUSDS-USDC Morpho
      market. Vault performance is driven by the underlying markets&apos; borrowing demand and is not
      controlled by Sky.money. Instead, it&apos;s adjusted dynamically by the Morpho smart contracts.
    </Trans>
  )
};

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
  const chains = useChains();
  const networks = productNetworks(
    Intent.VAULTS_INTENT,
    chains.map(chain => chain.id),
    vault.vaultAddress
  );

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
      about={{ body: VAULT_ABOUT[vault.name] ?? NO_VALUE, learnMoreHref: USER_RISKS_URL }}
      transactions={<VaultTransactionsTable vaultAddress={vaultAddress} />}
    />
  );
}
