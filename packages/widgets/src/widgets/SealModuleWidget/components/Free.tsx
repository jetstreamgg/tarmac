import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { TOKENS, useVault, useSimulatedVault, getIlkName } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect } from 'react';
import { useConnection } from 'wagmi';
import { SealModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { SealFlow } from '../lib/constants';

export const Free = ({
  isConnectedAndEnabled,
  sealedAmount,
  onChange
}: {
  isConnectedAndEnabled: boolean;
  sealedAmount?: bigint;
  onChange?: (val: bigint, userTriggered?: boolean) => void;
}) => {
  const { address } = useConnection();
  const ilkName = getIlkName(1);

  const { setMkrToFree, mkrToFree, usdsToWipe, acceptedExitFee, setIsLockCompleted, activeUrn } =
    useContext(SealModuleWidgetContext);
  const { widgetState } = useContext(WidgetContext);

  const mkrSealed = sealedAmount || 0n;

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newDebtValue = (existingVault?.debtValue || 0n) - usdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount = (existingVault?.collateralAmount || 0n) - mkrToFree;

  const { data: simulatedVault, isLoading } = useSimulatedVault(
    // Collateral amounts must be > 0
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingVault?.debtValue || 0n
  );

  const isLiquidationError =
    !!mkrToFree &&
    mkrToFree > 0n &&
    simulatedVault?.liquidationProximityPercentage &&
    simulatedVault?.liquidationProximityPercentage > 99;

  useEffect(() => {
    const isFreeComplete = !!mkrSealed && mkrToFree <= mkrSealed && !isLiquidationError && !isLoading;
    // If the user is managing their position, they have already accepted the exit fee
    setIsLockCompleted(
      (widgetState.flow === SealFlow.MANAGE || acceptedExitFee || mkrToFree === 0n) && isFreeComplete
    );
  }, [acceptedExitFee, mkrToFree, mkrSealed, widgetState.flow, isLiquidationError, isLoading]);

  const isMkrSupplyBalanceError =
    address && (mkrSealed || mkrSealed === 0n) && mkrToFree > mkrSealed && mkrToFree !== 0n; //don't wait for debouncing on default state

  return (
    <div>
      <TokenInput
        className="w-full"
        label={t`How much would you like to unseal?`}
        placeholder={t`Enter amount`}
        token={TOKENS.mkr}
        tokenList={[TOKENS.mkr]}
        balance={mkrSealed}
        value={mkrToFree}
        onChange={(val, event) => {
          setMkrToFree(val);
          onChange?.(val, !!event);
        }}
        dataTestId="supply-first-input-lse"
        error={(() => {
          if (isMkrSupplyBalanceError) {
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
