import { useCallback } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import {
  useVaultMarketData,
  useErc4626VaultData,
  useMorphoVaultRewards,
  getTokenDecimals,
  type Token,
  type VaultProvider
} from '@/hooks';
import { formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { PositionHero } from '@/components/product/PositionHero';
import {
  ProductActions,
  ProductPositionCard,
  ProductStat,
  ProductStatPair
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useClaimRewardsModal } from '@/modules/claim';
import { useVaultModal } from '../hooks/useVaultModal';
import { VaultSupplyCard } from './VaultSupplyCard';

const NO_VALUE = '–';

/**
 * Position-aware action card for the vault product page (ProductDetailTemplate
 * `position` slot). The ERC-4626 position picks the card:
 *  - no position (incl. disconnected) → the no-position "Supply" entry card.
 *  - has position → the "My position" summary below, with Supply / Claim rewards
 *    (Merkl) / Withdraw buttons that each open their shared modal.
 *
 * All amount entry happens in the modals; neither card renders an inline input.
 */
export function VaultPositionCard({
  vaultAddress,
  assetToken,
  vaultName,
  provider
}: {
  vaultAddress: `0x${string}`;
  assetToken: Token;
  vaultName: string;
  /** Gates the Morpho branding on the no-position card. */
  provider: VaultProvider;
}) {
  const chainId = useChainId();
  const { isConnected } = useConnection();
  const decimals = getTokenDecimals(assetToken, chainId);

  const { data: marketData } = useVaultMarketData({ provider: 'morpho', vaultAddress });
  const netRate = marketData?.rate?.netRate;

  const { data: vaultData, mutate: mutateVault } = useErc4626VaultData({ vaultAddress });
  const { data: rewardsData, mutate: mutateRewards } = useMorphoVaultRewards({ vaultAddress });

  // Refresh the position + rewards after a supply/withdraw/claim. A no-position
  // supply also flips this card to "My position" once userAssets refetches > 0.
  const refresh = useCallback(() => {
    mutateVault();
    mutateRewards();
  }, [mutateVault, mutateRewards]);

  const { openSupply, openWithdraw } = useVaultModal({ onSuccess: refresh });
  const { openClaim } = useClaimRewardsModal({ onSuccess: refresh });

  // Per-vault inputs for the supply/withdraw modal (passed at open time).
  const modalArgs = { vaultAddress, assetToken, vaultName, netRate };

  const userAssets = vaultData?.userAssets ?? 0n;
  const hasPosition = userAssets > 0n;
  if (!hasPosition) {
    return (
      <VaultSupplyCard
        assetToken={assetToken}
        vaultName={vaultName}
        provider={provider}
        netRate={netRate}
        onSupply={() => openSupply(modalArgs)}
      />
    );
  }

  // Position value in asset units (USDC is $1-pegged, so it doubles as the USD
  // value used for the projection).
  const positionValue = parseFloat(formatUnits(userAssets, decimals));
  const projectedEarnings = projectAnnualEarnings(positionValue, netRate);
  const reward = rewardsData?.rewards[0];

  const assetIcon = (
    <TokenIcon
      token={{ symbol: assetToken.symbol }}
      width={12}
      showChainIcon={false}
      className="h-3 w-3 shrink-0"
    />
  );

  return (
    <ProductPositionCard
      data-testid="vault-position-card"
      hero={
        <PositionHero
          pillSymbol={assetToken.symbol}
          balanceSymbol={assetToken.symbol}
          amount={positionValue}
        />
      }
      stats={
        <>
          <ProductStatPair grow>
            {/* The comp's "Supply" is the deposited principal; with no
                cost-basis source it restates the position balance the hero
                shows — same gap as "Already earned" below. */}
            <ProductStat label={<Trans>Supply</Trans>}>
              {assetIcon}
              {formatNumber(positionValue, { maxDecimals: 2 })}
            </ProductStat>
            <ProductStat label={<Trans>Est. earnings (1Y)</Trans>}>
              <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
              {formatNumber(projectedEarnings, { maxDecimals: 2 })}
              {assetIcon}
            </ProductStat>
          </ProductStatPair>
          <ProductStatPair grow>
            {/* No cost-basis source yet → dash (PRD: unavailable values read "–"). */}
            <ProductStat label={<Trans>Already earned</Trans>}>
              <span className="text-fgSecondary">{NO_VALUE}</span>
            </ProductStat>
            <ProductStat label={<Trans>Claimable rewards</Trans>}>
              {reward ? (
                <>
                  {reward.formattedAmount}
                  <TokenIcon
                    token={{ symbol: reward.tokenSymbol }}
                    width={12}
                    showChainIcon={false}
                    className="h-3 w-3 shrink-0"
                  />
                </>
              ) : (
                <span className="text-fgSecondary">{NO_VALUE}</span>
              )}
            </ProductStat>
          </ProductStatPair>
        </>
      }
      actions={
        /* Supply / Claim rewards / Withdraw — each opens its shared modal. The
           comp (859:38037) gives Supply the full width over a secondary pair. */
        <div className="flex flex-col gap-3">
          <ProductActions>
            <Button
              variant="primary"
              size="l"
              onClick={() => openSupply(modalArgs)}
              disabled={!isConnected}
              data-testid="vault-position-supply"
            >
              <Trans>Supply</Trans>
            </Button>
          </ProductActions>
          <ProductActions>
            {rewardsData?.hasClaimableRewards && (
              <Button
                variant="secondary"
                size="l"
                onClick={() => openClaim({ kind: 'vault', vaultAddress })}
                data-testid="vault-position-claim"
              >
                <Trans>Claim rewards</Trans>
              </Button>
            )}
            <Button
              variant="secondary"
              size="l"
              onClick={() => openWithdraw(modalArgs)}
              disabled={!isConnected}
              data-testid="vault-position-withdraw"
            >
              <Trans>Withdraw</Trans>
            </Button>
          </ProductActions>
        </div>
      }
    />
  );
}
