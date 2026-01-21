import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import {
  TOKENS,
  useVault,
  useSimulatedVault,
  getIlkName,
  RISK_LEVEL_THRESHOLDS,
  RiskLevel
} from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect } from 'react';
import { useConnection } from 'wagmi';
import { StakeModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeFlow } from '../lib/constants';

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
  const ilkName = getIlkName(2);

  const { setSkyToFree, skyToFree, usdsToWipe, setIsLockCompleted, activeUrn } =
    useContext(StakeModuleWidgetContext);
  const { widgetState } = useContext(WidgetContext);

  const skySealed = sealedAmount || 0n;

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newDebtValue = (existingVault?.debtValue || 0n) - usdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount = (existingVault?.collateralAmount || 0n) - skyToFree;

  const { data: simulatedVault, isLoading } = useSimulatedVault(
    // Collateral amounts must be > 0
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingVault?.debtValue || 0n,
    ilkName
  );

  const liquidationRiskThreshold = RISK_LEVEL_THRESHOLDS.find(
    riskLevel => riskLevel.level === RiskLevel.LIQUIDATION
  )?.threshold;

  const isLiquidationError =
    !!skyToFree &&
    skyToFree > 0n &&
    simulatedVault?.liquidationProximityPercentage &&
    liquidationRiskThreshold &&
    simulatedVault?.liquidationProximityPercentage > liquidationRiskThreshold;

  useEffect(() => {
    const isFreeComplete = !!skySealed && skyToFree <= skySealed && !isLiquidationError && !isLoading;
    // If the user is managing their position, they have already accepted the exit fee
    setIsLockCompleted((widgetState.flow === StakeFlow.MANAGE || skyToFree === 0n) && isFreeComplete);
  }, [skyToFree, skySealed, widgetState.flow, isLiquidationError, isLoading]);

  const isSkySupplyBalanceError =
    address && (skySealed || skySealed === 0n) && skyToFree > skySealed && skyToFree !== 0n;

  return (
    <div>
      <TokenInput
        className="w-full"
        label={t`How much SKY would you like to unstake?`}
        placeholder={t`Enter amount`}
        token={TOKENS.sky}
        tokenList={[TOKENS.sky]}
        balance={skySealed}
        value={skyToFree}
        onChange={(val, event) => {
          setSkyToFree(val);
          onChange?.(val, !!event);
        }}
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
