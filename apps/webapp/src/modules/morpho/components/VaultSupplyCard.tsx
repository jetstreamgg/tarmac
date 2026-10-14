import type { ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useTokenBalance, getTokenDecimals, type MorphoVaultRateData, type Token } from '@/hooks';
import { formatDecimalPercentage } from '@/utils';
import { Button } from '@/components/ui/button';
import { HeaderBadge } from '@/components/ui/page-header';
import { ProductSupplyCard } from '@/components/product/ProductCard';
import { InlineTokenLabel } from '@/components/product/InlineTokenLabel';
import { formatIdleBalance, SupplyCardStats } from '@/components/product/SupplyCardStats';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { RateInfo } from '@/components/product/RateInfo';
import { hasRateBreakdown, VaultRateMark, VaultRateTooltip } from './VaultRateBreakdown';
import { Morpho } from '@/modules/icons';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { NO_VALUE } from '@/lib/constants';

/**
 * Per-vault blurb (APP-526 item 7): the same one-liner the risk card shows,
 * keyed by the config name - the one stable, chain-independent vault id.
 */
const VAULT_DESCRIPTIONS: Record<string, ReactNode> = {
  'USDT Savings': (
    <Trans>Vault deployed on Morpho with a single exposure to sUSDS collateralized debt.</Trans>
  ),
  'USDS Flagship': (
    <Trans>
      Vault deployed on Morpho, with a conservative allocation and around 80% of liquidity available for
      instant withdrawal.
    </Trans>
  ),
  'USDT Risk Capital': (
    <Trans>Vault deployed on Morpho, with a single exposure to stUSDS collateralized debt.</Trans>
  ),
  'USDS Risk Capital': (
    <Trans>Vault deployed on Morpho, with a single exposure to stUSDS collateralized debt.</Trans>
  ),
  'USDC Risk Capital': (
    <Trans>Vault deployed on Morpho, with a single exposure to stUSDS collateralized debt.</Trans>
  )
};

function VaultDescription({ vaultName }: { vaultName: string }) {
  return <>{VAULT_DESCRIPTIONS[vaultName] ?? null}</>;
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
  netRate,
  rateData,
  onSupply
}: {
  assetToken: Token;
  vaultName: string;
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
  const idleBalance = formatIdleBalance(
    isConnected && balance ? parseFloat(formatUnits(balance.value, decimals)) : undefined
  );

  const assetIcon = <InlineTokenLabel symbol={assetToken.symbol} />;

  return (
    <ProductSupplyCard
      data-testid="vault-supply-card"
      badges={
        <HeaderBadge size="s" icon={<Morpho className="size-4 rounded-sm" />}>
          <Trans>Powered by Morpho</Trans>
        </HeaderBadge>
      }
      title={
        <Trans>
          Supply {assetIcon} at {rate} APY
        </Trans>
      }
      description={<VaultDescription vaultName={vaultName} />}
      stats={
        <SupplyCardStats
          rate={rate}
          rateFigure={
            <>
              {/* The rate carries the DS sparkle rather than a token mark — the
                  vault's yield is not one asset's — and hovering it opens the
                  breakdown (APP-443 item 14; the mark shipped without one).
                  Both are gated on the rate actually being incentive-boosted,
                  so an unboosted vault no longer flags a boost it doesn't have
                  — and never shows a mark the tooltip can't explain. */}
              <VaultRateTooltip rate={rateData}>
                {rate}
                {hasRateBreakdown(rateData) && <VaultRateMark className="text-statusInfoSolid" />}
              </VaultRateTooltip>
              <RateInfo type="morpho" />
            </>
          }
          idle={idleBalance}
          idleIcon={
            <TokenIcon
              token={{ symbol: assetToken.symbol }}
              width={16}
              showChainIcon={false}
              className="h-4 w-4 shrink-0"
            />
          }
        />
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
