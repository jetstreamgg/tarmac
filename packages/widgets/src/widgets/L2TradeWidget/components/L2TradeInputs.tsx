import { type GetBalanceData } from 'wagmi/query';
import { Button } from '@widgets/components/ui/button';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { ShiftArrow } from '@widgets/shared/components/icons/Icons';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { TradeInput } from '@widgets/widgets/TradeWidget/components/TradeInputs';
import { TokenForChain, Token, tokenArrayFiltered } from '@jetstreamgg/hooks';
import { t } from '@lingui/core/macro';
import { motion } from 'framer-motion';
import { useState, useRef, useMemo, useEffect } from 'react';
import { TradeSide } from '@widgets/widgets/TradeWidget/lib/constants';

type TokenBalanceData = Omit<GetBalanceData, 'symbol'> & {
  symbol?: string;
};

type TradeInputsProps = {
  setOriginAmount: (amount: bigint) => void;
  originAmount: bigint;
  originBalance: TokenBalanceData | undefined;
  originToken?: TokenForChain;
  targetBalance: TokenBalanceData | undefined;
  targetToken?: TokenForChain;
  setOriginToken: (token?: TokenForChain) => void;
  setTargetToken: (token?: TokenForChain) => void;
  setTargetAmount: (amount: bigint) => void;
  targetAmount: bigint;
  originTokenList: TokenForChain[];
  targetTokenList: TokenForChain[];
  isBalanceError: boolean;
  canSwitchTokens: boolean;
  isConnectedAndEnabled: boolean;
  lastUpdated: TradeSide;
  onUserSwitchTokens?: (originToken?: string, targetToken?: string) => void;
  onOriginInputChange?: (val: bigint, userTriggered?: boolean) => void;
  onTargetInputChange: (val: bigint) => void;
  onOriginInputInput?: () => void;
  onTargetInputInput?: () => void;
  setMaxWithdraw?: (val: boolean) => void;
  onOriginTokenChange?: (token: TokenForChain) => void;
  onTargetTokenChange?: (token: TokenForChain) => void;
};

export function L2TradeInputs({
  setOriginAmount,
  originBalance,
  originToken,
  targetBalance,
  targetToken,
  originAmount,
  targetAmount,
  setOriginToken,
  setTargetToken,
  setTargetAmount,
  originTokenList,
  targetTokenList,
  isBalanceError,
  canSwitchTokens,
  isConnectedAndEnabled = true,
  lastUpdated,
  onUserSwitchTokens,
  onOriginInputChange,
  onTargetInputChange,
  onOriginInputInput,
  onTargetInputInput,
  onOriginTokenChange,
  onTargetTokenChange
  // setMaxWithdraw
}: TradeInputsProps) {
  const separationPx = 12;
  const separationMb = 'mb-[12px]';
  const topInputRef = useRef<HTMLDivElement>(null);
  const bottomInputRef = useRef<HTMLDivElement>(null);
  const [isSwitchVisible, setIsSwitchVisible] = useState<boolean>(true);
  const [switchPosition, setSwitchPosition] = useState<{ top: string; left: string }>({
    top: '50%',
    left: '50%'
  });

  const updatePosition = () => {
    if (topInputRef.current && bottomInputRef.current) {
      const topInputEndY = topInputRef.current.offsetTop + topInputRef.current.offsetHeight;
      const newPositionTop = `${topInputEndY - separationPx / 2}px`;
      setSwitchPosition({ top: newPositionTop, left: '50%' });
    }
  };

  useEffect(() => {
    const topObserver = new ResizeObserver(updatePosition);

    if (topInputRef.current) {
      topObserver.observe(topInputRef.current);
    }

    // Cleanup
    return () => {
      if (topInputRef.current) {
        topObserver.unobserve(topInputRef.current);
      }
    };
  }, []);

  const originList = useMemo(
    () => tokenArrayFiltered(originTokenList, targetToken),
    [originTokenList, targetToken]
  );

  const targetList = useMemo(
    () => tokenArrayFiltered(targetTokenList, originToken),
    [targetTokenList, originToken]
  );

  const switchDisabled = !canSwitchTokens;

  // Hide switch button when top popover is open
  useEffect(() => {
    if (topInputRef.current) {
      const observer = new MutationObserver(mutationsList => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
            const target = mutation.target as HTMLElement;
            setIsSwitchVisible(target.getAttribute('data-state') === 'closed');
          } else if (mutation.type === 'childList') {
            setIsSwitchVisible(true);
          }
        }
      });

      const config = { attributes: true, childList: true, subtree: true, attributeFilter: ['data-state'] };
      observer.observe(topInputRef.current, config);

      return () => observer.disconnect();
    }
  }, [topInputRef]);

  return (
    <VStack className="relative h-auto items-stretch" gap={0}>
      <motion.div variants={positionAnimations} ref={topInputRef}>
        <TradeInput
          className={`${separationMb} w-full`}
          label={t`Choose a token to trade, and enter an amount`}
          token={originToken as Token}
          balance={originBalance?.value}
          onChange={(newValue, event) => {
            onOriginInputChange?.(BigInt(newValue), !!event);
          }}
          onInput={onOriginInputInput}
          value={originAmount}
          dataTestId="trade-input-origin"
          tokenList={originList as Token[]}
          onTokenSelected={option => {
            setOriginToken(option as TokenForChain);
            onOriginTokenChange?.(option as TokenForChain);
          }}
          error={isBalanceError ? t`Insufficient funds` : undefined}
          variant="top"
          extraPadding={true}
          showPercentageButtons={isConnectedAndEnabled}
          enabled={isConnectedAndEnabled}
        />
      </motion.div>
      <div
        className="flex justify-center"
        style={{
          position: 'absolute',
          zIndex: 10,
          left: switchPosition.left,
          top: switchPosition.top,
          transform: 'translate(-50%, -50%)',
          visibility: isSwitchVisible ? 'visible' : 'hidden',
          cursor: switchDisabled ? 'not-allowed' : 'pointer'
        }}
      >
        <Button
          aria-label="Switch token inputs"
          size="icon"
          className="border-background text-tabPrimary focus:outline-hidden my-0 h-9 w-9 rounded-full bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent disabled:bg-transparent"
          onClick={() => {
            const tempToken = originToken;
            const prevOriginAmount = originAmount;
            const prevTargetAmount = targetAmount;
            setOriginAmount(0n);
            setTargetAmount(0n);
            setTimeout(() => {
              setOriginToken(targetToken);
              setTargetToken(tempToken);
              setTimeout(() => {
                if (lastUpdated === TradeSide.IN) {
                  setTargetAmount(prevOriginAmount);
                  setOriginAmount(0n);
                } else {
                  setOriginAmount(prevTargetAmount);
                  setTargetAmount(0n);
                }
                onUserSwitchTokens?.(targetToken?.symbol, originToken?.symbol);
              }, 500);
            }, 500);
          }}
          disabled={switchDisabled}
        >
          <ShiftArrow height={24} className="text-textDesaturated" />
        </Button>
      </div>
      <motion.div variants={positionAnimations} ref={bottomInputRef}>
        <TradeInput
          className="w-full"
          label={t`Choose a token to receive`}
          variant="bottom"
          token={targetToken as Token}
          balance={targetBalance?.value}
          onChange={onTargetInputChange}
          onInput={onTargetInputInput}
          value={targetAmount}
          dataTestId="trade-input-target"
          tokenList={targetList as Token[]}
          onTokenSelected={option => {
            setTargetToken(option as TokenForChain);
            onTargetTokenChange?.(option as TokenForChain);
          }}
          showPercentageButtons={false}
          enabled={isConnectedAndEnabled}
          inputDisabled={originToken?.isNative}
        />
      </motion.div>
    </VStack>
  );
}
