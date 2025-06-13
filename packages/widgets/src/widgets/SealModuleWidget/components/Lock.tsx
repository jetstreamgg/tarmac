import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Token, TOKENS, useTokenBalance } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { SealModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { SealFlow } from '../lib/constants';

export const Lock = ({
  isConnectedAndEnabled,
  onChange
}: {
  isConnectedAndEnabled: boolean;
  onChange?: (val: bigint, userTriggered?: boolean) => void;
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { widgetState } = useContext(WidgetContext);
  const {
    mkrToLock,
    setMkrToLock,
    skyToLock,
    setSkyToLock,
    acceptedExitFee,
    setIsLockCompleted,
    selectedToken,
    setSelectedToken,
    setUsdsToBorrow
  } = useContext(SealModuleWidgetContext);

  const { data: mkrBalance } = useTokenBalance({ address, token: TOKENS.mkr.address[chainId], chainId });
  const { data: skyBalance } = useTokenBalance({ address, token: TOKENS.sky.address[chainId], chainId });

  useEffect(() => {
    // If the user is managing their position, they have already accepted the exit fee
    const hasAcceptedExitFee = widgetState.flow === SealFlow.MANAGE || acceptedExitFee || mkrToLock === 0n;
    const canLockZeroWhenManaging = mkrToLock > 0n || skyToLock > 0n || widgetState.flow === SealFlow.MANAGE; // can lock 0 when managing
    const hasSufficientMkrBalance = !!mkrBalance && mkrToLock <= mkrBalance.value;
    const hasSufficientSkyBalance = !!skyBalance && skyToLock <= skyBalance.value;
    const hasSufficientBalance =
      selectedToken === TOKENS.mkr ? hasSufficientMkrBalance : hasSufficientSkyBalance;

    setIsLockCompleted(hasAcceptedExitFee && canLockZeroWhenManaging && hasSufficientBalance);
  }, [acceptedExitFee, mkrToLock, mkrBalance, skyToLock, skyBalance, widgetState.flow, selectedToken]);

  const isMkrSupplyBalanceError =
    address &&
    (mkrBalance?.value || mkrBalance?.value === 0n) &&
    mkrToLock > mkrBalance.value &&
    mkrToLock !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isSkySupplyBalanceError =
    address &&
    (skyBalance?.value || skyBalance?.value === 0n) &&
    skyToLock > skyBalance.value &&
    skyToLock !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isSupplyBalanceError =
    selectedToken === TOKENS.mkr ? isMkrSupplyBalanceError : isSkySupplyBalanceError;
  const balance = selectedToken === TOKENS.mkr ? mkrBalance?.value : skyBalance?.value;
  const amountToLock = selectedToken === TOKENS.mkr ? mkrToLock : skyToLock;
  const setAmountToLock = selectedToken === TOKENS.mkr ? setMkrToLock : setSkyToLock;

  return (
    <div>
      <TokenInput
        className="w-full"
        label={t`How much ${selectedToken.symbol} would you like to seal?`}
        placeholder={t`Enter amount`}
        token={selectedToken}
        tokenList={[TOKENS.mkr, TOKENS.sky]}
        balance={balance}
        value={amountToLock}
        onChange={(val, event) => {
          setAmountToLock(val);
          onChange?.(val, !!event);
        }}
        onTokenSelected={option => {
          if (option.symbol !== selectedToken?.symbol) {
            setSelectedToken(option as Token);
            setMkrToLock(0n);
            setSkyToLock(0n);
            setUsdsToBorrow(0n);
          }
        }}
        dataTestId="supply-first-input-lse"
        error={isSupplyBalanceError ? t`Insufficient funds` : undefined}
        showPercentageButtons={isConnectedAndEnabled}
        enabled={isConnectedAndEnabled}
      />
    </div>
  );
};
