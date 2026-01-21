import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { TOKENS, useTokenBalance } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { StakeModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeFlow } from '../lib/constants';

export const Lock = ({
  isConnectedAndEnabled,
  onChange
}: {
  isConnectedAndEnabled: boolean;
  onChange?: (val: bigint, userTriggered?: boolean) => void;
}) => {
  const { address } = useConnection();
  const chainId = useChainId();
  const { widgetState } = useContext(WidgetContext);
  const { skyToLock, setSkyToLock, setIsLockCompleted } = useContext(StakeModuleWidgetContext);

  const { data: skyBalance } = useTokenBalance({ address, token: TOKENS.sky.address[chainId], chainId });

  useEffect(() => {
    const canLockZeroWhenManaging = skyToLock > 0n || widgetState.flow === StakeFlow.MANAGE; // can lock 0 when managing
    const hasSufficientBalance = !!skyBalance && skyToLock <= skyBalance.value;

    setIsLockCompleted(canLockZeroWhenManaging && hasSufficientBalance);
  }, [skyToLock, skyBalance, widgetState.flow]);

  const isSupplyBalanceError =
    address &&
    (skyBalance?.value || skyBalance?.value === 0n) &&
    skyToLock > skyBalance.value &&
    skyToLock !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  return (
    <div>
      <TokenInput
        className="w-full"
        label={t`How much SKY would you like to stake?`}
        placeholder={t`Enter amount`}
        token={TOKENS.sky}
        tokenList={[TOKENS.sky]}
        balance={skyBalance?.value}
        value={skyToLock}
        onChange={(val, event) => {
          setSkyToLock(val);
          onChange?.(val, !!event);
        }}
        dataTestId="supply-first-input-lse"
        error={isSupplyBalanceError ? t`Insufficient funds` : undefined}
        showPercentageButtons={isConnectedAndEnabled}
        enabled={isConnectedAndEnabled}
      />
    </div>
  );
};
