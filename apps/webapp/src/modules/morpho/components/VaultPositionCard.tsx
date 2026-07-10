import { ReactNode, useCallback } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import {
  useVaultMarketData,
  useErc4626VaultData,
  useMorphoVaultRewards,
  getTokenDecimals,
  type Token
} from '@/hooks';
import { formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PositionHero } from '@/components/product/PositionHero';
import { GainValue } from '@/components/ui/GainValue';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useClaimRewardsModal } from '@/modules/claim';
import { useVaultModal } from '../hooks/useVaultModal';
import { VaultSupplyCard } from './VaultSupplyCard';

const NO_VALUE = '–';

function StatRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

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
  vaultName
}: {
  vaultAddress: `0x${string}`;
  assetToken: Token;
  vaultName: string;
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
      <VaultSupplyCard assetToken={assetToken} netRate={netRate} onSupply={() => openSupply(modalArgs)} />
    );
  }

  // Position value in asset units (USDC is $1-pegged, so it doubles as the USD
  // value used for the projection).
  const positionValue = parseFloat(formatUnits(userAssets, decimals));
  const shares =
    vaultData?.userShares !== undefined
      ? formatNumber(parseFloat(formatUnits(vaultData.userShares, vaultData.decimals)), { maxDecimals: 2 })
      : NO_VALUE;
  const projectedEarnings = projectAnnualEarnings(positionValue, netRate);
  const reward = rewardsData?.rewards[0];

  return (
    <Card className="flex flex-col gap-5 p-2" data-testid="vault-position-card">
      <PositionHero pillSymbol={assetToken.symbol} balanceSymbol={assetToken.symbol} amount={positionValue} />

      <div className="flex flex-col gap-5 px-3 pb-3">
        <div className="flex flex-col gap-3">
          <StatRow label={<Trans>Shares</Trans>}>
            <TokenIcon
              token={{ symbol: assetToken.symbol }}
              width={18}
              showChainIcon={false}
              className="h-4.5 w-4.5"
            />
            {shares} {assetToken.symbol}
          </StatRow>
          <StatRow label={<Trans>1Y projected earnings</Trans>}>
            <GainValue value={projectedEarnings} />
          </StatRow>
          {/* No cost-basis source yet — placeholder per the redesign. */}
          <StatRow label={<Trans>Interest earned</Trans>}>
            <span className="text-textSecondary">TODO</span>
          </StatRow>
          <StatRow label={<Trans>Rewards to be claimed</Trans>}>
            {reward ? (
              <>
                <TokenIcon
                  token={{ symbol: reward.tokenSymbol }}
                  width={18}
                  showChainIcon={false}
                  className="h-4.5 w-4.5"
                />
                {reward.formattedAmount} {reward.tokenSymbol}
              </>
            ) : (
              NO_VALUE
            )}
          </StatRow>
        </div>

        {/* Supply / Claim rewards / Withdraw — each opens its shared modal. */}
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="l"
            className="w-full"
            onClick={() => openSupply(modalArgs)}
            disabled={!isConnected}
            data-testid="vault-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          {rewardsData?.hasClaimableRewards && (
            <Button
              variant="secondary"
              size="l"
              className="w-full"
              onClick={() => openClaim({ kind: 'vault', vaultAddress })}
              data-testid="vault-position-claim"
            >
              <Trans>Claim rewards</Trans>
            </Button>
          )}
          <Button
            variant="secondary"
            size="l"
            className="w-full"
            onClick={() => openWithdraw(modalArgs)}
            disabled={!isConnected}
            data-testid="vault-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </Card>
  );
}
