import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { TOKENS, useVault, useSimulatedVault, getIlkName, Token } from '@jetstreamgg/sky-hooks';
import { math } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useContext, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
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
  const { address } = useAccount();
  const ilkName = getIlkName(1);

  const {
    setMkrToFree,
    setSkyToFree,
    mkrToFree,
    skyToFree,
    usdsToWipe,
    acceptedExitFee,
    setIsLockCompleted,
    activeUrn,
    selectedToken,
    setSelectedToken
  } = useContext(SealModuleWidgetContext);
  const { widgetState } = useContext(WidgetContext);

  const mkrSealed = sealedAmount || 0n;

  const skySealed = useMemo(() => {
    return sealedAmount ? sealedAmount * math.MKR_TO_SKY_RATE : 0n;
  }, [sealedAmount]);

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newDebtValue = (existingVault?.debtValue || 0n) - usdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount =
    selectedToken === TOKENS.mkr
      ? (existingVault?.collateralAmount || 0n) - mkrToFree
      : (existingVault?.collateralAmount || 0n) * math.MKR_TO_SKY_RATE - skyToFree;

  const { data: simulatedVault, isLoading } = useSimulatedVault(
    // Collateral amounts must be > 0
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingVault?.debtValue || 0n
  );

  const isLiquidationError =
    !!(selectedToken === TOKENS.mkr ? mkrToFree : skyToFree) &&
    (selectedToken === TOKENS.mkr ? mkrToFree : skyToFree) > 0n &&
    simulatedVault?.liquidationProximityPercentage &&
    simulatedVault?.liquidationProximityPercentage > 99;

  useEffect(() => {
    const isFreeComplete =
      !!(selectedToken === TOKENS.mkr ? mkrSealed : skySealed) &&
      (selectedToken === TOKENS.mkr ? mkrToFree : skyToFree) <=
        (selectedToken === TOKENS.mkr ? mkrSealed : skySealed) &&
      !isLiquidationError &&
      !isLoading;
    // If the user is managing their position, they have already accepted the exit fee
    setIsLockCompleted(
      (widgetState.flow === SealFlow.MANAGE ||
        acceptedExitFee ||
        (selectedToken === TOKENS.mkr ? mkrToFree : skyToFree) === 0n) &&
        isFreeComplete
    );
  }, [
    acceptedExitFee,
    mkrToFree,
    skyToFree,
    mkrSealed,
    skySealed,
    widgetState.flow,
    isLiquidationError,
    isLoading,
    selectedToken
  ]);

  const isMkrSupplyBalanceError =
    address &&
    (mkrSealed || mkrSealed === 0n) &&
    (selectedToken === TOKENS.mkr ? mkrToFree : skyToFree) > mkrSealed &&
    (selectedToken === TOKENS.mkr ? mkrToFree : skyToFree) !== 0n; //don't wait for debouncing on default state

  const isSkySupplyBalanceError =
    address &&
    (skySealed || skySealed === 0n) &&
    (selectedToken === TOKENS.sky ? skyToFree : mkrToFree) > skySealed &&
    (selectedToken === TOKENS.sky ? skyToFree : mkrToFree) !== 0n;

  return (
    <div>
      <TokenInput
        className="w-full"
        label={t`How much would you like to unseal?`}
        placeholder={t`Enter amount`}
        token={selectedToken}
        tokenList={[TOKENS.mkr, TOKENS.sky]}
        balance={selectedToken === TOKENS.mkr ? mkrSealed : skySealed}
        value={selectedToken === TOKENS.mkr ? mkrToFree : skyToFree}
        onChange={(val, event) => {
          if (selectedToken === TOKENS.mkr) {
            setMkrToFree(val);
          } else {
            setSkyToFree(val);
          }
          onChange?.(val, !!event);
        }}
        onTokenSelected={option => {
          if (option.symbol !== selectedToken?.symbol) {
            setSelectedToken(option as Token);
            if (selectedToken === TOKENS.mkr) {
              setMkrToFree(0n);
            } else {
              setSkyToFree(0n);
            }
          }
        }}
        dataTestId="supply-first-input-lse"
        error={(() => {
          if (selectedToken === TOKENS.mkr) {
            if (isMkrSupplyBalanceError) {
              return t`Insufficient funds`;
            }
            if (isLiquidationError) {
              return t`Liquidation risk too high`;
            }
            return undefined;
          } else {
            return isSkySupplyBalanceError ? t`Insufficient funds` : undefined;
          }
        })()}
        showPercentageButtons={isConnectedAndEnabled}
        enabled={isConnectedAndEnabled}
      />
    </div>
  );
};
