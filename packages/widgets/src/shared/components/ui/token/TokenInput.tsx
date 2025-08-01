import { MotionCard, MotionCardContent } from '@widgets/components/ui/card';
import { Popover, PopoverAnchor, PopoverContent, PopoverPortal } from '@widgets/components/ui/popover';
import { Input } from '@widgets/components/ui/input';
import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@widgets/components/ui/button';
import { cn } from '@widgets/lib/utils';
import { formatUnits, parseUnits } from 'viem';
import { formatBigInt, truncateStringToFourDecimals } from '@jetstreamgg/sky-utils';
import { HStack } from '../layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { VStack } from '../layout/VStack';
import { createSvgCardMask } from '@widgets/lib/svgMask';
import { Wallet } from '../../icons/Wallet';
import { tokenColors } from '@widgets/shared/constants';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { easeOutExpo } from '@widgets/shared/animation/timingFunctions';
import { AnimationLabels } from '@widgets/shared/animation/constants';
import { TokenListItem } from './TokenListItem';
import { TokenSelector } from './TokenSelector';
import { useChainId } from 'wagmi';

export interface TokenInputProps {
  label?: string;
  placeholder?: string;
  token?: Token;
  onTokenSelected?: (token: Token) => void;
  onChange: (
    val: bigint,
    e?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>
  ) => void;
  onInput?: () => void;
  tokenList: Token[];
  balance?: bigint;
  value?: bigint;
  className?: string;
  disabled?: boolean;
  inputDisabled?: boolean;
  error?: string;
  errorTooltip?: string;
  variant?: 'bottom' | 'top';
  onSetMax?: (val: boolean) => void;
  dataTestId?: string;
  showPercentageButtons?: boolean;
  buttonsToShow?: number[];
  extraPadding?: boolean;
  enabled?: boolean;
  maxIntegerDigits?: number;
  borrowLimitText?: string | undefined;
}

export function TokenInput({
  token,
  tokenList,
  balance,
  variant,
  error,
  errorTooltip,
  className,
  label,
  value,
  disabled,
  inputDisabled = false,
  dataTestId = 'token-input',
  placeholder,
  onChange,
  onInput,
  onTokenSelected,
  onSetMax,
  showPercentageButtons = true,
  buttonsToShow = [25, 50, 100],
  extraPadding = false,
  enabled = true,
  borrowLimitText,
  maxIntegerDigits
}: TokenInputProps): React.ReactElement {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const chainId = useChainId();
  const decimals = token ? getTokenDecimals(token, chainId) : 18;
  const color = useMemo(() => {
    return token?.color || tokenColors.find(t => t.symbol === token?.symbol)?.color || '#6d7ce3';
  }, [token]);

  // The input value should be able to be changed by the user in any way, and only trigger the change when the units are correct.
  const [inputValue, setInputValue] = useState<`${number}` | ''>(
    value && value !== 0n ? (formatUnits(value, decimals) as `${number}`) : ''
  );
  const [errorInvalidFormat, setErrorInvalidFormat] = useState(false);
  const shownError = errorInvalidFormat ? 'Invalid amount. Please enter a valid amount.' : error;

  const updateValue = (
    val: `${number}`,
    event?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    //prevent exponential notation
    if (val.includes('e')) return;

    //truncate if too many decimals
    const parts = val.split('.');
    if (parts.length === 2 && parts[1].length > decimals) {
      val = (parts[0] + '.' + parts[1].substring(0, decimals)) as `${number}`;
    }

    //same as above but for formats that use commas istead of periods
    const partsComma = val.split(',');
    if (partsComma.length === 2 && partsComma[1].length > decimals) {
      val = (partsComma[0] + ',' + partsComma[1].substring(0, decimals)) as `${number}`;
    }

    // Prevent overflow by limiting integer part length
    // ethers.js FixedNumber uses internal 128-bit precision for calculations.
    // When multiplying two FixedNumbers (like in collateralValue = ink * price),
    // we need to ensure the result doesn't overflow. Since both operands can have
    // up to N digits, the result can have up to 2N digits internally.
    // Using 38 total digits ensures safe multiplication: 38/2 = 19 digits per operand,
    // which when squared (19^2 ≈ 10^38) stays well within 128-bit bounds (≈ 10^39).
    const DEFAULT_MAX_TOTAL_DIGITS = 38;
    const maxDigits = maxIntegerDigits ?? Math.max(DEFAULT_MAX_TOTAL_DIGITS - decimals, 1);
    const integerPart = val.split(/[.,]/)[0];
    if (integerPart.length > maxDigits) {
      return; // Don't update if too many digits
    }

    setInputValue(val);

    try {
      // Use bigint to validate the number
      const newValue = parseUnits(val || '0', decimals);

      if (newValue < 0n) {
        throw new Error('Invalid');
      }

      setErrorInvalidFormat(false);

      onChange(newValue, event);
    } catch (e) {
      console.error('Error updating value: ', e);
      setErrorInvalidFormat(true);
      onChange(0n, event);
      return;
    }
  };

  useEffect(() => {
    if (value === undefined) {
      setInputValue('');
    } else {
      try {
        const valueDiffers = parseUnits(inputValue || '0', decimals) !== value;
        if (valueDiffers) {
          setInputValue(formatUnits(value, decimals) as `${number}`);
        }
      } catch (e) {
        console.error('Error setting input value: ', e);
        setErrorInvalidFormat(true);
        onChange(0n);
      }
    }
  }, [value]);

  //clear the input if we switch to a disabled state
  useEffect(() => {
    if (disabled || inputDisabled) {
      setInputValue('');
    }
  }, [disabled, inputDisabled]);

  useEffect(() => {
    const newValue = parseUnits(inputValue, decimals);
    const needsUpdate = value !== newValue;
    if (inputValue && needsUpdate) updateValue(inputValue);
  }, [token?.decimals]);

  const onPercentageClicked = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    percentage: number,
    max = false
  ) => {
    e.stopPropagation();

    if (balance === undefined) {
      return;
    }
    // treat the percentage button click as an input change and execute this callback
    onInput?.();

    const newValue = (balance * BigInt(Math.round(percentage))) / 100n;
    const formattedValue = formatUnits(newValue, decimals);

    if (max) {
      updateValue(formatUnits(balance, decimals) as `${number}`, e);
      if (typeof onSetMax === 'function') onSetMax(true);
    } else {
      // Truncate the string to two decimal places
      const truncatedValue = truncateStringToFourDecimals(formattedValue);
      // Update the value
      updateValue(truncatedValue as `${number}`, e);
      if (typeof onSetMax === 'function') onSetMax(false);
    }
  };

  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return;

    const updateSize = () => {
      setWidth(cardElement.offsetWidth);
      setHeight(cardElement.offsetHeight);
    };
    updateSize();

    // Create observer to watch for changes in card size
    const observer = new MutationObserver(updateSize);
    observer.observe(cardElement, { childList: true, subtree: true });

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  //   Circle position is inverse than the variant
  const mask = createSvgCardMask(width, height, 20, 6, variant === 'top' ? 'bottom' : 'top');
  const style = variant
    ? {
        WebkitMaskImage: `url('${mask}')`,
        maskBorder: `url('${mask}')`
      }
    : undefined;

  const isConnectedAndEnabled = balance !== undefined && enabled;

  const balanceText = useMemo(() => {
    if (!isConnectedAndEnabled) {
      return 'No wallet connected';
    }
    if (!token) {
      return '';
    }

    return `${formatBigInt(balance, {
      unit: decimals
    })} ${token.symbol.toUpperCase()}`;
  }, [balance, token, enabled]);

  return (
    <Popover>
      <PopoverAnchor>
        <MotionCard
          ref={cardRef}
          className={cn(
            'hover-in-before pb-4! min-h-16 w-96 overflow-hidden rounded-2xl border-0',
            className
          )}
          style={{
            ...style,
            background: `radial-gradient(100% 333.15% at 0% 100%, rgba(255, 255, 255, 0) 0%, ${color}1A 100%) ${color}0D`,
            backgroundBlendMode: 'overlay'
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <MotionCardContent className={`p-0 ${token ? '' : 'max-h-[59px]'}`}>
            <Text className="text-text text-sm font-normal leading-none">{label}</Text>
            <AnimatePresence mode="popLayout" initial={false}>
              {token ? (
                <motion.div
                  key="selected-token"
                  initial={AnimationLabels.initial}
                  animate={AnimationLabels.animate}
                >
                  <motion.div variants={positionAnimations}>
                    <Input
                      ref={inputRef}
                      className="hide-spin-button placeholder:text-white/30"
                      value={inputValue !== '00' ? inputValue : '0'}
                      onChange={e => {
                        updateValue(e.target.value as `${number}`, e);
                        if (typeof onSetMax === 'function') onSetMax(false);
                      }}
                      onInput={() => {
                        onInput?.();
                      }}
                      disabled={disabled || inputDisabled}
                      //prevent scrolling to change input
                      onWheel={e => (e.target as HTMLElement).blur()}
                      type="number"
                      placeholder={placeholder || 'Enter amount'}
                      rightElement={
                        <TokenSelector
                          token={token}
                          disabled={disabled || tokenList.length <= 1}
                          showChevron={tokenList.length > 1}
                        />
                      }
                      error={shownError}
                      errorTooltip={errorTooltip}
                      data-testid={dataTestId}
                      step={'any'}
                      min={0}
                    />
                  </motion.div>
                  <motion.div variants={positionAnimations}>
                    <HStack className="justify-between pt-4">
                      <HStack
                        gap={2}
                        className={`text-selectActive ${'w-full'} items-center overflow-clip`}
                        title={balanceText}
                      >
                        {(!borrowLimitText || !isConnectedAndEnabled) && (
                          <div>
                            <Wallet height={20} width={20} className="text-textDesaturated" />
                          </div>
                        )}
                        <Text
                          className="text-textDesaturated text-nowrap text-sm leading-none"
                          dataTestId={`${dataTestId}-balance`}
                        >
                          {borrowLimitText && isConnectedAndEnabled ? borrowLimitText : balanceText}
                        </Text>
                      </HStack>
                      {showPercentageButtons && (
                        <HStack gap={2} className="text-selectActive items-center">
                          {buttonsToShow.map(percentage => (
                            <Button
                              key={percentage}
                              size="input"
                              variant="input"
                              onClick={e => onPercentageClicked(e, percentage, percentage === 100)}
                              disabled={disabled}
                              data-testid={percentage === 100 ? `${dataTestId}-max` : undefined}
                            >
                              {`${percentage}%`}
                            </Button>
                          ))}
                        </HStack>
                      )}
                    </HStack>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: easeOutExpo }}
                  key="no-token"
                >
                  <TokenSelector token={token} disabled={disabled} extraBottomPadding={extraPadding} />
                </motion.div>
              )}
            </AnimatePresence>
          </MotionCardContent>
        </MotionCard>
      </PopoverAnchor>
      <PopoverPortal container={cardRef.current}>
        <PopoverContent
          className="bg-container rounded-[20px] border-0 p-2 pr-0 pt-5 backdrop-blur-[50px]"
          sideOffset={4}
          avoidCollisions={true}
          style={{ width: `${width}px` }}
        >
          <VStack className="w-full space-y-2">
            <motion.div variants={positionAnimations}>
              <Text className="text-selectActive ml-5 text-sm font-medium leading-none">
                <Trans>Select token</Trans>
              </Text>
            </motion.div>
            {/* 185px is 3 rows of 60px */}
            <VStack className="scrollbar-thin max-h-[185px] space-y-2 overflow-y-scroll">
              {tokenList?.map((token, index) => (
                <TokenListItem
                  key={token.symbol}
                  token={token}
                  onTokenSelected={onTokenSelected}
                  data-testid={`${dataTestId}-menu-item-${index}`}
                  enabled={enabled}
                />
              ))}
            </VStack>
          </VStack>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
