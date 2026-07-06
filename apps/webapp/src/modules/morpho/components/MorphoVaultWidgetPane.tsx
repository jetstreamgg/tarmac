import { MorphoVaultWidget, TxStatus, WidgetStateChangeParams, VaultFlow, VaultAction } from '@/widgets';
import { Token, type VaultProvider } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
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
  const { linkedActionConfig, updateLinkedActionConfig, exitLinkedActionMode, setSelectedVaultsOption } =
    useConfigContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as VaultFlow | undefined;

  // Get addresses for the current chain
  const currentVaultAddress = vaultAddress[chainId];
  const currentAssetAddress = assetToken.address[chainId as keyof typeof assetToken.address];

  const onMorphoVaultWidgetStateChange = ({
    txStatus,
    widgetState,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions: only sync when the URL's module matches this
    // vault's own provider (Spark → `spark`, Morpho → `morpho`).
    if (searchParams.get(QueryParams.VaultModule) !== vaultModuleForProvider(provider)) {
      return;
    }

    // Update amount in URL if provided and not zero
    if (originAmount && originAmount !== '0') {
      setSearchParams(prev => {
        prev.set(QueryParams.InputAmount, originAmount);
        return prev;
      });
    } else if (originAmount === '') {
      setSearchParams(prev => {
        prev.delete(QueryParams.InputAmount);
        return prev;
      });
    }

    // Set flow search param based on widgetState.flow
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Flow, flow);
        return prev;
      });
    }

    // After a successful linked action SUPPLY, set the final step to "success"
    if (
      widgetState.action === VaultAction.SUPPLY &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.COMPLETED_CURRENT
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.COMPLETED_SUCCESS });
    }

    // Reset the linked action state and URL params after clicking "finish"
    if (txStatus === TxStatus.IDLE && linkedActionConfig.step === LinkedActionSteps.COMPLETED_SUCCESS) {
      exitLinkedActionMode();
      setSearchParams(prevParams => {
        const params = deleteSearchParams(prevParams);
        return params;
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
      externalWidgetState={{
        amount: linkedActionConfig?.inputAmount,
        flow
      }}
      onBackToVaults={handleBack}
    />
  );
}
