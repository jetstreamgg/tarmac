import { type GetBalanceData } from 'wagmi/query';
import { t } from '@lingui/core/macro';
import { TradeSide } from '../lib/constants';
import { ShiftArrow } from '@widgets/shared/components/icons/Icons';
import { TradeDetails } from './TradeDetails';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OrderQuoteResponse, Token, tokenArrayFiltered, TokenForChain } from '@jetstreamgg/sky-hooks';
import { TokenInput, TokenInputProps } from '@widgets/shared/components/ui/token/TokenInput';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Button } from '@widgets/components/ui/button';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { CostWarning } from './CostWarning';
import { getQuoteErrorForType } from '../lib/utils';
import { useMediaQuery } from '@jetstreamgg/sky-utils';

type TokenBalanceData = Omit<GetBalanceData, 'symbol'> & {
  symbol?: string;
};

type TradeInputsProps = {
  setOriginAmount: (amount: bigint) => void;
  originAmount: bigint;
  setLastUpdated: (side: TradeSide) => void;
  lastUpdated: TradeSide;
  originBalance: TokenBalanceData | undefined;
  originToken?: TokenForChain;
  targetBalance: TokenBalanceData | undefined;
  targetToken?: TokenForChain;
  setOriginToken: (token?: TokenForChain) => void;
  setTargetToken: (token?: TokenForChain) => void;
  setTargetAmount: (amount: bigint) => void;
  targetAmount: bigint;
  quoteData: OrderQuoteResponse | null | undefined;
  quoteError: Error | null;
  originTokenList: TokenForChain[];
  targetTokenList: TokenForChain[];
  isBalanceError: boolean;
  isQuoteLoading: boolean;
  canSwitchTokens: boolean;
  priceImpact: number | undefined;
  feePercentage: number | undefined;
  isConnectedAndEnabled: boolean;
  onUserSwitchTokens?: (originToken?: string, targetToken?: string) => void;
  tradeAnyway: boolean;
  setTradeAnyway: (tradeAnyway: boolean) => void;
  onOriginTokenChange?: (token: TokenForChain) => void;
  onTargetTokenChange?: (token: TokenForChain) => void;
  onOriginInputChange?: (val: bigint, userTriggered?: boolean) => void;
  enableSearch?: boolean;
  tokensLocked?: boolean;
};

export function TradeInput(props: TokenInputProps) {
  const { token } = props;
  if (!props.tokenList) return <Text className="mt-2 text-center">The selected token has no pairs</Text>;

  return <TokenInput {...props} token={token} />;
}

export function TradeInputs({
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
  setLastUpdated,
  lastUpdated,
  quoteData,
  quoteError,
  originTokenList,
  targetTokenList,
  isBalanceError,
  canSwitchTokens,
  isQuoteLoading,
  priceImpact,
  feePercentage,
  isConnectedAndEnabled = true,
  onUserSwitchTokens,
  tradeAnyway,
  setTradeAnyway,
  onOriginTokenChange,
  onTargetTokenChange,
  onOriginInputChange,
  enableSearch = false,
  tokensLocked = false
}: TradeInputsProps) {
  const separationPx = 12;
  const separationMb = 'mb-[12px]';
  const topInputRef = useRef<HTMLDivElement>(null);
  const bottomInputRef = useRef<HTMLDivElement>(null);
  const [switchPosition, setSwitchPosition] = useState<{ top: string; left: string }>({
    top: '50%',
    left: '50%'
  });
  const isSmallScreen = useMediaQuery('(max-height: 900px)');

  // Use shorter token list on smaller screens to prevent overflow
  const maxVisibleTokenRows = isSmallScreen ? 2.5 : 4.5;

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

  const onTradeAnywayChange = (tradeAnyway: boolean) => {
    setTradeAnyway(tradeAnyway);
  };

  const [isSwitchVisible, setIsSwitchVisible] = useState<boolean>(true);

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

  const switchDisabled = !canSwitchTokens || isQuoteLoading;

  return (
    <VStack className="relative h-auto items-stretch" gap={0}>
      <motion.div variants={positionAnimations} ref={topInputRef}>
        <TradeInput
          key={originToken?.symbol || 'no-origin-token'}
          className={`${separationMb} w-full`}
          label={t`Choose a token to trade, and enter an amount`}
          token={originToken as Token}
          balance={originBalance?.value}
          onChange={(newValue, event) => {
            setLastUpdated(TradeSide.IN);
            setOriginAmount(BigInt(newValue));
            onOriginInputChange?.(BigInt(newValue), !!event);
          }}
          value={originAmount}
          dataTestId="trade-input-origin"
          tokenList={originList as Token[]}
          onTokenSelected={option => {
            setTargetAmount(0n);
            // This check prevents the widget from crashing as this combination will throw an error
            // https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/entities/token.ts#L79
            if (
              (targetToken?.symbol === 'ETH' && option.symbol === 'WETH') ||
              (targetToken?.symbol === 'WETH' && option.symbol === 'ETH')
            ) {
              setTargetToken(undefined);
            }

            setOriginToken(option as TokenForChain);
            onOriginTokenChange?.(option as TokenForChain);
          }}
          error={isBalanceError ? t`Insufficient funds` : undefined}
          variant={tokensLocked ? undefined : 'top'}
          extraPadding={!tokensLocked}
          showPercentageButtons={isConnectedAndEnabled}
          enabled={isConnectedAndEnabled}
          enableSearch={enableSearch}
          maxVisibleTokenRows={maxVisibleTokenRows}
        />
      </motion.div>
      {!tokensLocked && (
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
              const auxOriginToken = originToken;
              setLastUpdated(TradeSide.IN);
              setOriginToken(targetToken);
              setTargetToken(auxOriginToken);
              // Clear both inputs when switching
              setOriginAmount(0n);
              setTargetAmount(0n);
              onUserSwitchTokens?.(targetToken?.symbol, auxOriginToken?.symbol);
            }}
            disabled={switchDisabled}
          >
            <ShiftArrow height={24} className="text-textDesaturated" />
          </Button>
        </div>
      )}
      <motion.div variants={positionAnimations} ref={bottomInputRef}>
        <TradeInput
          key={targetToken?.symbol || 'no-target-token'}
          className="w-full"
          label={t`Choose a token to receive`}
          variant={tokensLocked ? undefined : 'bottom'}
          token={targetToken as Token}
          balance={targetBalance?.value}
          onChange={newValue => {
            setLastUpdated(TradeSide.OUT);
            setTargetAmount(BigInt(newValue));
          }}
          value={targetAmount}
          dataTestId="trade-input-target"
          tokenList={targetList as Token[]}
          onTokenSelected={option => {
            setTargetAmount(0n);
            setTargetToken(option as TokenForChain);
            onTargetTokenChange?.(option as TokenForChain);
          }}
          showPercentageButtons={false}
          enabled={isConnectedAndEnabled}
          inputDisabled={originToken?.isNative}
          enableSearch={enableSearch}
          maxVisibleTokenRows={maxVisibleTokenRows}
        />
      </motion.div>
      {quoteError && (
        <motion.div variants={positionAnimations}>
          <Text variant="medium" className="text-error px-4 pt-4">
            {getQuoteErrorForType(quoteError.message)}
          </Text>
        </motion.div>
      )}
      {isConnectedAndEnabled && (
        <motion.div variants={positionAnimations}>
          <CostWarning
            priceImpact={priceImpact}
            feePercentage={feePercentage}
            tradeAnyway={tradeAnyway}
            onTradeAnywayChange={onTradeAnywayChange}
          />
        </motion.div>
      )}
      <motion.div variants={positionAnimations}>
        <TradeDetails
          quoteData={quoteData}
          originToken={originToken}
          targetToken={targetToken}
          exactInput={lastUpdated === TradeSide.IN}
          isQuoteLoading={isQuoteLoading}
          priceImpact={priceImpact}
        />
      </motion.div>
    </VStack>
  );
}
