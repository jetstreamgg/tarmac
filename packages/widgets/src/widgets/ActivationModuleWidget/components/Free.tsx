import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { TOKENS, useVault, useSimulatedVault, getIlkName } from '@jetstreamgg/hooks';
import { math } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';
import { useContext, useEffect, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ActivationModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { ActivationFlow } from '../lib/constants';

export const Free = ({
  isConnectedAndEnabled,
  sealedAmount
}: {
  isConnectedAndEnabled: boolean;
  sealedAmount?: bigint;
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const ilkName = getIlkName(chainId);

  const { setSkyToFree, skyToFree, usdsToWipe, acceptedExitFee, setIsLockCompleted, activeUrn } = useContext(
    ActivationModuleWidgetContext
  );
  const { widgetState } = useContext(WidgetContext);

  const skySealed = useMemo(() => {
    return sealedAmount ? sealedAmount * math.MKR_TO_SKY_PRICE_RATIO : 0n;
  }, [sealedAmount]);

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newDebtValue = (existingVault?.debtValue || 0n) - usdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount =
    (existingVault?.collateralAmount || 0n) * math.MKR_TO_SKY_PRICE_RATIO - skyToFree;

  const { data: simulatedVault, isLoading } = useSimulatedVault(
    // Collateral amounts must be > 0
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingVault?.debtValue || 0n
  );

  const isLiquidationError =
    !!skyToFree &&
    skyToFree > 0n &&
    simulatedVault?.liquidationProximityPercentage &&
    simulatedVault?.liquidationProximityPercentage > 99;

  useEffect(() => {
    const isFreeComplete = !!skySealed && skyToFree <= skySealed && !isLiquidationError && !isLoading;
    // If the user is managing their position, they have already accepted the exit fee
    setIsLockCompleted(
      (widgetState.flow === ActivationFlow.MANAGE || acceptedExitFee || skyToFree === 0n) && isFreeComplete
    );
  }, [acceptedExitFee, skyToFree, skySealed, widgetState.flow, isLiquidationError, isLoading]);

  const isSkySupplyBalanceError =
    address && (skySealed || skySealed === 0n) && skyToFree > skySealed && skyToFree !== 0n;

  return (
    <div>
      <TokenInput
        className="w-full"
        label={t`How much would you like to unseal?`}
        placeholder={t`Enter amount`}
        token={TOKENS.sky}
        tokenList={[TOKENS.sky]}
        balance={skySealed}
        value={skyToFree}
        onChange={setSkyToFree}
        dataTestId="supply-first-input-lse"
        error={(() => {
          if (isSkySupplyBalanceError) {
            return t`Insufficient funds`;
          }
          if (isLiquidationError) {
            return t`Liquidation risk too high`;
          }
          return undefined;
        })()}
        showPercentageButtons={isConnectedAndEnabled}
        enabled={isConnectedAndEnabled}
      />
    </div>
  );
};
