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
import { formatNumber, projectAnnualEarnings, splitAmount } from '@/utils';
import { Button } from '@/components/ui/button';
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
  const { whole, fraction } = splitAmount(positionValue);
  const shares =
    vaultData?.userShares !== undefined
      ? formatNumber(parseFloat(formatUnits(vaultData.userShares, vaultData.decimals)), { maxDecimals: 2 })
      : NO_VALUE;
  const projectedEarnings = projectAnnualEarnings(positionValue, netRate);
  const reward = rewardsData?.rewards[0];

  return (
    <div
      className="bg-panel flex flex-col gap-5 rounded-[20px] p-2 backdrop-blur-2xl"
      data-testid="vault-position-card"
    >
      {/* Hero — "My position" pill + balance over a soft brand-tinted inset. */}
      <div className="flex flex-col gap-6 rounded-2xl bg-[radial-gradient(130%_130%_at_15%_0%,_rgba(126,107,242,0.22)_0%,_rgba(58,46,125,0.1)_55%,_transparent_100%)] p-5">
        <span className="bg-surface text-textSecondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm">
          <TokenIcon
            token={{ symbol: assetToken.symbol }}
            width={16}
            showChainIcon={false}
            className="h-4 w-4"
          />
          <Trans>My position</Trans>
        </span>
        <span className="text-text flex items-end gap-2 font-semibold">
          <TokenIcon
            token={{ symbol: assetToken.symbol }}
            width={32}
            showChainIcon={false}
            className="mb-1 h-8 w-8"
          />
          <span className="text-4xl leading-none">{whole}</span>
          {fraction && <span className="text-textSecondary text-2xl leading-tight">.{fraction}</span>}
        </span>
      </div>

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
              className="w-full"
              onClick={() => openClaim({ kind: 'vault', vaultAddress })}
              data-testid="vault-position-claim"
            >
              <Trans>Claim rewards</Trans>
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => openWithdraw(modalArgs)}
            disabled={!isConnected}
            data-testid="vault-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
