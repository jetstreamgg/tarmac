import { MotionCard, MotionCardContent } from '@/widgets/components/ui/card';
import { Popover, PopoverAnchor, PopoverContent, PopoverPortal } from '@/widgets/components/ui/popover';
import { Input } from '@/widgets/components/ui/input';
import { getTokenDecimals, Token } from '@/hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/widgets/components/ui/button';
import { cn } from '@/widgets/lib/utils';
import { formatUnits } from 'viem';
import { formatBigInt, truncateStringToFourDecimals } from '@/utils';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/amountInput';
import { HStack } from '../layout/HStack';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { VStack } from '../layout/VStack';
import { createSvgCardMask } from '@/widgets/lib/svgMask';
import { Wallet } from '../../icons/Wallet';
import { Gauge } from '../../icons/Gauge';
import { tokenColors } from '@/widgets/shared/constants';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'motion/react';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import { easeOutExpo } from '@/widgets/shared/animation/timingFunctions';
import { AnimationLabels } from '@/widgets/shared/animation/constants';
import { TokenListItem } from './TokenListItem';
import { TokenSelector } from './TokenSelector';
import { useChainId } from 'wagmi';
import { Search } from '../../icons/Search';
import { Close } from '../../icons/Close';
import { useIsTouchDevice } from '@/hooks';

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
  /** Display-only variant: replaces the editable input with a formatted readout. */
  readOnly?: boolean;
  error?: string;
  errorTooltip?: string;
  variant?: 'bottom' | 'top';
  onSetMax?: (val: boolean) => void;
  dataTestId?: string;
  showPercentageButtons?: boolean;
  buttonsToShow?: number[];
  extraPadding?: boolean;
  hideIcon?: boolean;
  enabled?: boolean;
  maxIntegerDigits?: number;
  limitText?: string | undefined;
  enableSearch?: boolean;
  showGauge?: boolean;
  maxVisibleTokenRows?: number;
  customActionButtons?: React.ReactNode;
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
  readOnly = false,
  dataTestId = 'token-input',
  placeholder,
  onChange,
  onInput,
  onTokenSelected,
  onSetMax,
  showPercentageButtons = true,
  buttonsToShow = [25, 50, 100],
  extraPadding = false,
  hideIcon = false,
  enabled = true,
  limitText,
  maxIntegerDigits,
  enableSearch = false,
  showGauge = false,
  maxVisibleTokenRows = 2,
  customActionButtons
}: TokenInputProps): React.ReactElement {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const tokenSelectorRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const chainId = useChainId();
  const decimals = getTokenDecimals(token, chainId);
  const color = useMemo(() => {
    return token?.color || tokenColors.find(t => t.symbol === token?.symbol)?.color || '#6d7ce3';
  }, [token]);
  const isTouchDevice = useIsTouchDevice();

  const TOKEN_ROW_HEIGHT = 62; // Height per token row (62px)
  const SEARCH_BAR_COMPENSATION = 60; // Additional height when search is disabled
  const maxTokenListHeight = Math.round(
    TOKEN_ROW_HEIGHT * maxVisibleTokenRows + (enableSearch ? 0 : SEARCH_BAR_COMPENSATION)
  );

  // The input value should be able to be changed by the user in any way, and only trigger the change when the units are correct.
  const [inputValue, setInputValue] = useState<`${number}` | ''>(
    value && value !== 0n ? (formatUnits(value, decimals) as `${number}`) : ''
  );

  const updateValue = (
    val: `${number}`,
    event?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    // Mask the text down to digits and at most one decimal point, the fraction
    // capped at the token's decimals. This replaces the hand-rolled truncation
    // and exponent guard that used to sit here, and it is also what reads a
    // decimal *comma* as a decimal point: iOS's numeric keypad carries one
    // decimal key labelled from the system locale, so on most of Europe a
    // comma is the only separator a user can type (APP-518).
    val = sanitizeAmountInput(val, decimals) as `${number}`;

    // Bigint multiplication (e.g. collateralValue = ink * price) is exact but
    // unbounded — a 40-digit input quietly produces 80-digit results that
    // overflow downstream consumers (BPS conversions, formatUnits string
    // rendering, on-chain uint256 calls). Capping the integer part to 38
    // total digits keeps the squared result safely under 10^76 and matches
    // historical bounds.
    const DEFAULT_MAX_TOTAL_DIGITS = 38;
    const maxDigits = maxIntegerDigits ?? Math.max(DEFAULT_MAX_TOTAL_DIGITS - decimals, 1);
    const integerPart = val.split('.')[0];
    if (integerPart.length > maxDigits) {
      return; // Don't update if too many digits
    }

    setInputValue(val);
    // Masked text always parses, and `parseAmountInput` also covers the
    // in-progress states ('' and a bare '.') that `parseUnits` chokes on.
    onChange(parseAmountInput(val, decimals), event);
  };

  useEffect(() => {
    if (value === undefined) {
      setInputValue('');
    } else if (parseAmountInput(inputValue, decimals) !== value) {
      setInputValue(formatUnits(value, decimals) as `${number}`);
    }
  }, [value]);

  useEffect(() => {
    const needsUpdate = value !== parseAmountInput(inputValue, decimals);
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
    })} ${token.symbol}`;
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
            'hover-in-before min-h-16 w-96 overflow-hidden rounded-2xl border-0',
            !readOnly && 'pb-4!',
            className
          )}
          style={{
            ...style,
            background: `radial-gradient(100% 333.15% at 0% 100%, rgba(255, 255, 255, 0) 0%, ${color}1A 100%) ${color}0D`,
            backgroundBlendMode: 'overlay'
          }}
          onClick={e => {
            // Don't focus input if clicking on the token selector (popover trigger)
            const target = e.target as HTMLElement;
            const isClickingTokenSelector = tokenSelectorRef.current?.contains(target);

            if (!isClickingTokenSelector) {
              inputRef.current?.focus();
            }
          }}
        >
          <MotionCardContent className={`p-0 ${token ? '' : 'max-h-[59px]'}`}>
            <Text className="text-text text-sm leading-none font-normal">{label}</Text>
            <AnimatePresence mode="popLayout" initial={false}>
              {token ? (
                <motion.div
                  key="selected-token"
                  initial={AnimationLabels.initial}
                  animate={AnimationLabels.animate}
                >
                  <motion.div variants={positionAnimations}>
                    {readOnly ? (
                      <HStack className="items-center justify-between pt-4 pb-1">
                        <div
                          className="text-text flex h-6 grow items-center truncate text-base lg:h-7 lg:text-lg"
                          data-testid={dataTestId}
                        >
                          {value && value !== 0n
                            ? formatBigInt(value, { unit: decimals, maxDecimals: 4 })
                            : '—'}
                        </div>
                        <div ref={tokenSelectorRef} className="shrink-0">
                          <TokenSelector
                            token={token}
                            disabled={disabled || tokenList.length <= 1}
                            showChevron={tokenList.length > 1}
                          />
                        </div>
                      </HStack>
                    ) : (
                      <Input
                        ref={inputRef}
                        className="light:placeholder:text-textDimmed placeholder:text-white/30"
                        value={inputValue !== '00' ? inputValue : '0'}
                        onChange={e => {
                          updateValue(e.target.value as `${number}`, e);
                          if (typeof onSetMax === 'function') onSetMax(false);
                        }}
                        onInput={() => {
                          onInput?.();
                        }}
                        disabled={disabled || inputDisabled}
                        // A `type="number"` control reports anything it cannot
                        // parse as the empty string, so a decimal comma — the
                        // only separator iOS's keypad offers under most European
                        // locales — never reached the handler and a fraction was
                        // unenterable on a phone (APP-518). The field is text
                        // now and masked in `updateValue`; `inputMode` keeps the
                        // numeric keypad.
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={placeholder || 'Enter amount'}
                        rightElement={
                          <div ref={tokenSelectorRef}>
                            <TokenSelector
                              token={token}
                              disabled={disabled || tokenList.length <= 1}
                              showChevron={tokenList.length > 1}
                            />
                          </div>
                        }
                        error={error}
                        errorTooltip={errorTooltip}
                        data-testid={dataTestId}
                      />
                    )}
                  </motion.div>
                  {!readOnly && (
                    <motion.div variants={positionAnimations}>
                      <HStack className="justify-between pt-4">
                        <HStack
                          gap={2}
                          className={`text-selectActive light:text-textSecondary ${'w-full'} items-center overflow-clip`}
                          title={balanceText}
                        >
                          {!hideIcon && limitText && isConnectedAndEnabled ? (
                            showGauge ? (
                              <div>
                                <Gauge height={20} width={20} className="text-textDesaturated" />
                              </div>
                            ) : (
                              <div>
                                <Wallet height={20} width={20} className="text-textDesaturated" />
                              </div>
                            )
                          ) : !hideIcon && (!limitText || !isConnectedAndEnabled) ? (
                            <div>
                              <Wallet height={20} width={20} className="text-textDesaturated" />
                            </div>
                          ) : null}
                          <Text
                            className="text-textDesaturated text-sm leading-none text-nowrap"
                            dataTestId={`${dataTestId}-balance`}
                          >
                            {limitText && isConnectedAndEnabled ? limitText : balanceText}
                          </Text>
                        </HStack>
                        {showPercentageButtons && (
                          <HStack gap={2} className="text-selectActive light:text-textSecondary items-center">
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
                        {customActionButtons && (
                          <HStack gap={2} className="text-selectActive light:text-textSecondary items-center">
                            {customActionButtons}
                          </HStack>
                        )}
                      </HStack>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: easeOutExpo }}
                  key="no-token"
                  ref={tokenSelectorRef}
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
          className="bg-container rounded-[20px] border-0 p-2 pt-5 pr-0 backdrop-blur-[50px]"
          sideOffset={4}
          avoidCollisions={true}
          style={{ width: `${width}px` }}
          onOpenAutoFocus={event => {
            // Prevent autofocus on mobile devices (touch-capable devices)
            if (isTouchDevice) {
              event.preventDefault();
            }
          }}
        >
          <VStack className="w-full space-y-2">
            <motion.div variants={positionAnimations}>
              <Text className="text-selectActive light:text-textSecondary font-circle ml-5 text-sm leading-none font-medium">
                <Trans>Select token</Trans>
              </Text>
            </motion.div>
            {enableSearch && (
              <motion.div variants={positionAnimations} className="px-2">
                <HStack gap={2} className="light:bg-surfaceAlt items-center rounded-xl bg-white/2 p-3">
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
                      className="text-textSecondary light:hover:text-text h-4 w-4 cursor-pointer transition-colors hover:text-white"
                      onClick={() => setSearchQuery('')}
                    />
                  )}
                </HStack>
              </motion.div>
            )}
            <VStack className="space-y-2 overflow-y-scroll" style={{ maxHeight: `${maxTokenListHeight}px` }}>
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
