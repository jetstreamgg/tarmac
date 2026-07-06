import { VaultTvlCard } from './VaultTvlCard';
import { MorphoMarketLiquidityCard } from './MorphoMarketLiquidityCard';
import { Token, useErc4626VaultData, useVaultMarketData, VaultProvider } from '@/hooks';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useChainId, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';

type VaultInfoDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
  /** Which provider operates the vault — drives the data source. Defaults to Morpho. */
  provider?: VaultProvider;
};

export function VaultInfoDetails({ vaultAddress, assetToken, provider = 'morpho' }: VaultInfoDetailsProps) {
  const isMorpho = provider === 'morpho';
  const chainId = useChainId();

  // Provider seam: the dispatcher returns Morpho's market API for Morpho and
  // Spark's live Savings API (normalized) for Spark — TVL + summed liquidity[]
  // through one shape. This is the authoritative source when present.
  const {
    data: marketData,
    isLoading: marketDataLoading,
    error: marketError
  } = useVaultMarketData({ provider, vaultAddress });

  // On-chain ERC-4626 fallback for non-Morpho (Spark) when the API is empty/down.
  // Disabled for Morpho (it reads everything from its API — no extra RPC).
  const {
    data: onChainData,
    isLoading: onChainLoading,
    error: onChainError
  } = useErc4626VaultData({ vaultAddress: isMorpho ? undefined : vaultAddress, provider });

  // Vault-level liquidity fallback = the asset the vault currently holds (its
  // un-deployed buffer), matching the in-widget card so both surfaces agree on
  // what "Available liquidity" means. This VAULT-level figure is distinct from
  // the per-user `maxWithdraw` that bounds an individual withdraw input.
  const assetAddress = assetToken.address[chainId as keyof typeof assetToken.address];
  const { data: onChainLiquidity, isLoading: onChainLiquidityLoading } = useReadContract({
    address: isMorpho ? undefined : assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId,
    query: { enabled: !isMorpho && !!assetAddress && !!vaultAddress }
  });

  // TVL: API-first for both providers. Morpho reads its market API; Spark reads our
  // sky.money Savings API (the dispatcher's normalized `totalAssets`) and falls back
  // to the on-chain ERC-4626 `totalAssets()` only when the API is empty/down. This
  // matches the expert stats card and the in-widget card, which are also API-first
  // for Spark.
  const totalAssets = isMorpho
    ? marketData?.totalAssets
    : (marketData?.totalAssets ?? onChainData?.totalAssets);
  // Available liquidity: API vault-level figure (summed `liquidity[]`), falling
  // back to the on-chain vault buffer for Spark.
  const liquidity = marketData?.liquidity ?? onChainLiquidity;

  // Morpho tracks its API's loading/error. For Spark, TVL is API-first with an
  // on-chain fallback, so we are loading only while no figure has resolved yet, and
  // we surface an error only if BOTH sources fail (a healthy fallback hides an API
  // outage). Liquidity keeps its own on-chain buffer fallback.
  const tvlLoading = isMorpho
    ? marketDataLoading
    : totalAssets === undefined && (marketDataLoading || onChainLoading);
  const tvlError = isMorpho ? marketError : totalAssets === undefined ? (marketError ?? onChainError) : null;
  const liquidityLoading = isMorpho ? marketDataLoading : onChainLiquidityLoading;

  // Fees apply to Morpho vaults only. Spark surfaces a single net APY with no fee
  // split, so the fee cards are omitted entirely for Spark (rendered below only
  // when isMorpho) rather than shown as a meaningless 0%.
  const managementFee = marketData?.rate?.formattedManagementFee ?? '-';
  const performanceFee = marketData?.rate?.formattedPerformanceFee ?? '-';

  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[250px] flex-1">
        <VaultTvlCard
          totalAssets={totalAssets}
          isLoading={tvlLoading}
          error={tvlError}
          assetToken={assetToken}
        />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketLiquidityCard
          liquidity={liquidity}
          isLoading={liquidityLoading}
          error={isMorpho ? marketError : null}
          assetToken={assetToken}
          provider={provider}
        />
      </div>
      {isMorpho && (
        <>
          <div className="min-w-[250px] flex-1">
            <StatsCard
              className="h-full"
              title={t`Management Fee`}
              content={<Text className="mt-2">{managementFee}</Text>}
              isLoading={marketDataLoading}
              error={marketError}
            />
          </div>
          <div className="min-w-[250px] flex-1">
            <StatsCard
              className="h-full"
              title={t`Performance Fee`}
              content={<Text className="mt-2">{performanceFee}</Text>}
              isLoading={marketDataLoading}
              error={marketError}
            />
          </div>
        </>
      )}
    </div>
  );
}
