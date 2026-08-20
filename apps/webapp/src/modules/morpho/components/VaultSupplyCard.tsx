import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import {
  useTokenBalance,
  getTokenDecimals,
  type MorphoVaultRateData,
  type Token,
  type VaultProvider
} from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { HeaderBadge } from '@/components/ui/page-header';
import {
  ProductFigure,
  ProductStat,
  ProductStatPair,
  ProductSupplyCard
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { hasRateIncentives, VaultRateMark, VaultRateTooltip } from './VaultRateBreakdown';
import { Morpho } from '@/widgets';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { NO_VALUE } from '@/lib/constants';

/**
 * Per-vault blurb. Only the USDC Risk Capital vault has approved copy so far
 * (Figma 859:37947); the rest keep the TODO placeholder until design delivers
 * theirs (APP-432 item 16).
 */
function VaultDescription({ vaultName }: { vaultName: string }) {
  if (vaultName === 'USDC Risk Capital') {
    return (
      <Trans>
        sky.money USDC Risk Capital vault accepts USDC deposits and deploys them exclusively into an
        stUSDS-USDC Morpho market.
      </Trans>
    );
  }
  // TODO: product description copy for the remaining vaults.
  return <>TODO</>;
}

/**
 * No-position vault entry card (Figma 859:37947): the "Powered by Morpho"
 * badge, a "Supply {asset} and earn X% APY" headline, the vault blurb, a
 * Current Rate / Idle balance stat pair and a full-width Supply CTA that opens
 * the shared supply modal. No inline input — all amount entry happens in the
 * modal.
 */
export function VaultSupplyCard({
  assetToken,
  vaultName,
  provider,
  netRate,
  rateData,
  onSupply
}: {
  assetToken: Token;
  vaultName: string;
  /** Gates the Morpho branding — the sUSDT vault runs on Spark infra. */
  provider: VaultProvider;
  /** Net APY as a decimal fraction (e.g. 0.0445). */
  netRate?: number;
  /** Full rate breakdown; drives the stars mark and its tooltip. */
  rateData?: MorphoVaultRateData;
  onSupply: () => void;
}) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const decimals = getTokenDecimals(assetToken, chainId);

  const { data: balance } = useTokenBalance({ address, chainId, token: assetToken.address[chainId] });

  // The CTA stays enabled while disconnected: clicking routes through the
  // connect flow and continues into the supply modal once connected.
  const onSupplyOrConnect = useConnectThenAct(onSupply, 'vault_supply');

  const rate = netRate !== undefined ? formatDecimalPercentage(netRate) : NO_VALUE;
  const idleBalance =
    isConnected && balance
      ? formatNumber(parseFloat(formatUnits(balance.value, decimals)), { maxDecimals: 2 })
      : NO_VALUE;

  const assetIcon = (
    <span className="whitespace-nowrap">
      <TokenIcon
        token={{ symbol: assetToken.symbol }}
        width={24}
        showChainIcon={false}
        className="mr-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6"
      />
      {assetToken.symbol}
    </span>
  );

  return (
    <ProductSupplyCard
      data-testid="vault-supply-card"
      badges={
        // Only Morpho-provided vaults claim the badge; the sUSDT vault runs on
        // Spark infra and would be mislabelled by it.
        provider === 'morpho' ? (
          <HeaderBadge size="s" icon={<Morpho className="size-4 rounded-sm" />}>
            <Trans>Powered by Morpho</Trans>
          </HeaderBadge>
        ) : undefined
      }
      title={
        <Trans>
          Supply {assetIcon} at {rate} APY
        </Trans>
      }
      description={<VaultDescription vaultName={vaultName} />}
      stats={
        <ProductStatPair>
          <ProductStat size="lg" label={<Trans>Current Rate</Trans>}>
            <ProductFigure value={rate}>
              {/* The rate carries the DS sparkle rather than a token mark — the
                  vault's yield is not one asset's — and hovering it opens the
                  breakdown (APP-443 item 14; the mark shipped without one).
                  Both are gated on the rate actually being incentive-boosted,
                  so an unboosted vault no longer flags a boost it doesn't have
                  — and never shows a mark the tooltip can't explain. */}
              <VaultRateTooltip rate={rateData}>
                {rate}
                {hasRateIncentives(rateData) && (
                  <VaultRateMark
                    className={provider === 'morpho' ? 'text-statusInfoSolid' : 'text-fgSecondary'}
                  />
                )}
              </VaultRateTooltip>
            </ProductFigure>
          </ProductStat>
          <ProductStat size="lg" label={<Trans>Idle balance</Trans>}>
            <ProductFigure value={idleBalance}>
              {idleBalance}
              <TokenIcon
                token={{ symbol: assetToken.symbol }}
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
          data-testid="vault-supply-cta"
        >
          <Trans>Supply</Trans>
        </Button>
      }
    />
  );
}
