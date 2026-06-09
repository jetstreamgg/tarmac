import { MorphoVaultWidget, WidgetStateChangeParams, VaultFlow } from '@/widgets';
import { Token, type VaultProvider } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useAppSearchParams } from '@/lib/router';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { useChainId } from 'wagmi';

type MorphoVaultWidgetPaneProps = SharedProps & {
  /** The vault contract address mapping by chain ID */
  vaultAddress: Record<number, `0x${string}`>;
  /** The underlying asset token */
  assetToken: Token;
  /** Display name for the vault */
  vaultName: string;
  /** Which provider operates the vault (branding + data source). Defaults to Morpho. */
  provider?: VaultProvider;
};

export function MorphoVaultWidgetPane({
  vaultAddress,
  assetToken,
  vaultName,
  provider = 'morpho',
  ...sharedProps
}: MorphoVaultWidgetPaneProps) {
  const chainId = useChainId();
  const { setSelectedVaultsOption } = useConfigContext();
  const [searchParams, setSearchParams] = useAppSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as VaultFlow | undefined;

  // Get addresses for the current chain
  const currentVaultAddress = vaultAddress[chainId];
  const currentAssetAddress = assetToken.address[chainId as keyof typeof assetToken.address];

  const onMorphoVaultWidgetStateChange = ({ widgetState }: WidgetStateChangeParams) => {
    // Prevent race conditions: only sync when the URL's module matches this
    // vault's own provider (Spark → `spark`, Morpho → `morpho`).
    if (searchParams.get(QueryParams.VaultModule) !== vaultModuleForProvider(provider)) {
      return;
    }

    // Set flow search param based on widgetState.flow
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Flow, flow);
        return prev;
      });
    }
  };

  const handleBack = () => {
    setSearchParams(params => {
      params.delete(QueryParams.VaultModule);
      params.delete(QueryParams.Vault);
      return params;
    });
    setSelectedVaultsOption(undefined);
  };

  if (!currentVaultAddress || !currentAssetAddress) {
    return null;
  }

  return (
    <MorphoVaultWidget
      {...sharedProps}
      vaultAddress={currentVaultAddress}
      assetAddress={currentAssetAddress}
      assetToken={assetToken}
      vaultName={vaultName}
      provider={provider}
      onWidgetStateChange={onMorphoVaultWidgetStateChange}
      externalWidgetState={{ flow }}
      onBackToVaults={handleBack}
    />
  );
}
