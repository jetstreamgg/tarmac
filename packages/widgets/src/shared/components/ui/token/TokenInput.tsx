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
import { Gauge } from '../../icons/Gauge';
import { tokenColors } from '@widgets/shared/constants';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { easeOutExpo } from '@widgets/shared/animation/timingFunctions';
import { AnimationLabels } from '@widgets/shared/animation/constants';
import { TokenListItem } from './TokenListItem';
import { TokenSelector } from './TokenSelector';
import { useChainId } from 'wagmi';
import { Search } from '../../icons/Search';
import { Close } from '../../icons/Close';

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
  limitText?: string | undefined;
  enableSearch?: boolean;
  showGauge?: boolean;
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
  limitText,
  maxIntegerDigits,
  enableSearch = false,
  showGauge = false
}: TokenInputProps): React.ReactElement {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const chainId = useChainId();
  const decimals = getTokenDecimals(token, chainId);
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

  const filteredTokenList = useMemo(() => {
    if (!enableSearch || !searchQuery) {
      return tokenList;
    }

    const query = searchQuery.toLowerCase().replace(/\s/g, ''); // Remove all spaces from the query
    return tokenList.filter(
      token => token.name.toLowerCase().includes(query) || token.symbol.toLowerCase().includes(query)
    );
  }, [tokenList, searchQuery, enableSearch]);

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
                        {limitText && isConnectedAndEnabled && showGauge ? (
                          <div>
                            <Gauge height={20} width={20} className="text-textDesaturated" />
                          </div>
                        ) : !limitText || !isConnectedAndEnabled ? (
                          <div>
                            <Wallet height={20} width={20} className="text-textDesaturated" />
                          </div>
                        ) : null}
                        <Text
                          className="text-textDesaturated text-nowrap text-sm leading-none"
                          dataTestId={`${dataTestId}-balance`}
                        >
                          {limitText && isConnectedAndEnabled ? limitText : balanceText}
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
            {enableSearch && (
              <motion.div variants={positionAnimations} className="px-2">
                <HStack gap={2} className="bg-white/2 items-center rounded-xl p-3">
                  <Search className="text-textSecondary h-4 w-4" />
                  <div className="grow">
                    <Input
                      type="text"
                      value={searchQuery}
                      placeholder="Search tokens"
                      className="placeholder:text-textSecondary h-5 text-sm leading-4 lg:text-sm lg:leading-4"
                      containerClassName="border-none p-0"
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {searchQuery && (
                    <Close
                      className="text-textSecondary h-4 w-4 cursor-pointer transition-colors hover:text-white"
                      onClick={() => setSearchQuery('')}
                    />
                  )}
                </HStack>
              </motion.div>
            )}
            {/* 185px is 3 rows of 60px, adjust height when search is enabled */}
            <VStack
              className={cn(
                'scrollbar-thin space-y-2 overflow-y-scroll',
                enableSearch ? 'max-h-[125px]' : 'max-h-[185px]'
              )}
            >
              {filteredTokenList?.map((token, index) => (
                <TokenListItem
                  key={token.symbol}
                  token={token}
                  onTokenSelected={onTokenSelected}
                  data-testid={`${dataTestId}-menu-item-${index}`}
                  enabled={enabled}
                />
              ))}
              {enableSearch && filteredTokenList.length === 0 && searchQuery && (
                <Text className="text-textDesaturated px-5 py-4 text-center text-sm">
                  No tokens found matching &quot;{searchQuery}&quot;
                </Text>
              )}
            </VStack>
          </VStack>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
