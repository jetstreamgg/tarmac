import { MorphoVaultWidget, WidgetStateChangeParams, VaultFlow } from '@/widgets';
import { Token, type VaultProvider } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteEntityParams } from '@/lib/navigation';
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
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const routeProvider = useRouteEntityParams().provider;

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as VaultFlow | undefined;

  // Get addresses for the current chain
  const currentVaultAddress = vaultAddress[chainId];
  const currentAssetAddress = assetToken.address[chainId as keyof typeof assetToken.address];

  const onMorphoVaultWidgetStateChange = ({ widgetState }: WidgetStateChangeParams) => {
    // Prevent race conditions: only sync when the route's provider segment
    // matches this vault's own provider.
    if (routeProvider !== vaultModuleForProvider(provider)) {
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
    void navigate({ to: '/vaults', search: keepSearch });
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
