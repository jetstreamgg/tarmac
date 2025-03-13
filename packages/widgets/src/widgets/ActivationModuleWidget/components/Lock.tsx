import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { TOKENS, useTokenBalance } from '@jetstreamgg/hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ActivationModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { ActivationFlow } from '../lib/constants';

export const Lock = ({ isConnectedAndEnabled }: { isConnectedAndEnabled: boolean }) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { widgetState } = useContext(WidgetContext);
  const { skyToLock, setSkyToLock, acceptedExitFee, setIsLockCompleted } = useContext(
    ActivationModuleWidgetContext
  );

  const { data: skyBalance } = useTokenBalance({ address, token: TOKENS.sky.address[chainId], chainId });

  useEffect(() => {
    // If the user is managing their position, they have already accepted the exit fee
    const hasAcceptedExitFee =
      widgetState.flow === ActivationFlow.MANAGE || acceptedExitFee || skyToLock === 0n;
    const canLockZeroWhenManaging = skyToLock > 0n || widgetState.flow === ActivationFlow.MANAGE; // can lock 0 when managing
    const hasSufficientBalance = !!skyBalance && skyToLock <= skyBalance.value;

    setIsLockCompleted(hasAcceptedExitFee && canLockZeroWhenManaging && hasSufficientBalance);
  }, [acceptedExitFee, skyToLock, skyBalance, widgetState.flow]);

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
        label={t`How much would you like to seal?`}
        placeholder={t`Enter amount`}
        token={TOKENS.sky}
        tokenList={[TOKENS.sky]}
        balance={skyBalance?.value}
        value={skyToLock}
        onChange={setSkyToLock}
        dataTestId="supply-first-input-lse"
        error={isSupplyBalanceError ? t`Insufficient funds` : undefined}
        showPercentageButtons={isConnectedAndEnabled}
        enabled={isConnectedAndEnabled}
      />
    </div>
  );
};
