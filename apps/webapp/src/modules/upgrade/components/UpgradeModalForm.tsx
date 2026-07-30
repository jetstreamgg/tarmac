import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useChainId, useChains, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { NetworkFeeValue, useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useNetworkFee } from '@/hooks';
import { TOKENS, useDebounce, useMkrSkyFee, useTokenBalance, type UpgradeSourceToken } from '@/hooks';
import { formatNumber, getChainIcon, math } from '@/utils';
import { TxStatus, PopoverRateInfo } from '@/widgets';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ArrowDown } from '@/modules/icons';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { UPGRADE_TARGET, useUpgradeLaunch } from '../hooks/useUpgradeLaunch';

const NO_VALUE = '–';
const PERCENT_OPTIONS = [25, 50, 100] as const;
const UPGRADE_SOURCE_TOKENS: UpgradeSourceToken[] = ['DAI', 'MKR'];

// DAI, MKR, USDS and SKY are all 18-decimal on mainnet.
const DECIMALS = 18;

const parseAmount = (value: string): bigint => {
  try {
    return value ? parseUnits(value, DECIMALS) : 0n;
  } catch {
    return 0n;
  }
};

const formatAmount = (amount: bigint) =>
  formatNumber(parseFloat(formatUnits(amount, DECIMALS)), { maxDecimals: 2 });

// The confirm-screen hero pins two decimals ("10,000.00", Figma 1310:130657);
// everywhere else trailing zeros drop, matching the Convert hero.
const formatHeroAmount = (amount: bigint) =>
  formatNumber(parseFloat(formatUnits(amount, DECIMALS)), { minDecimals: 2, maxDecimals: 2 });

function TokenOption({ symbol }: { symbol: string }) {
  return (
    <span className="flex items-center gap-1">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <Text className="text-sm font-medium">{symbol}</Text>
    </span>
  );
}

/**
 * The `DAI ▾` source-token chip (Figma 1310:130759): both upgradeable tokens
 * are listed; the target (USDS / SKY) is implied by the fixed pair, so only
 * the source is selectable. Same DS Button / Dropdown recipe as
 * `ConvertTokenSelect`.
 */
function UpgradeTokenSelect({
  value,
  onChange
}: {
  value: UpgradeSourceToken;
  onChange: (next: UpgradeSourceToken) => void;
}) {
  return (
    <Select value={value} onValueChange={next => onChange(next as UpgradeSourceToken)}>
      <SelectTrigger
        data-testid="upgrade-token-select"
        aria-label={t`Select token to upgrade`}
        className={cn(
          buttonVariants({ variant: 'dropdown', size: 'dropdownS' }),
          'h-auto w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue>
          <TokenOption symbol={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {UPGRADE_SOURCE_TOKENS.map(symbol => (
          <SelectItem key={symbol} value={symbol}>
            <TokenOption symbol={symbol} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TokenChip({ symbol }: { symbol: string }) {
  return (
    <span className="bg-glassBadge flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <Text className="text-text text-sm font-medium">{symbol}</Text>
    </span>
  );
}

/** One labelled cell of the details grid (label 12px secondary over 14px value). */
function DetailCell({
  label,
  value,
  dataTestId,
  className
}: {
  label: ReactNode;
  value: ReactNode;
  dataTestId?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)} data-testid={dataTestId}>
      <span className="text-textSecondary flex items-center gap-1 text-xs">{label}</span>
      <span className="text-text flex items-center gap-1 text-sm font-medium">{value}</span>
    </div>
  );
}

/** `◉ 1.00 = ◉ 24,000.00` — the token-iconed rate pair (Figma 1343:99472). */
function RateValue({ source, target, targetRate }: { source: string; target: string; targetRate: string }) {
  return (
    <>
      <TokenIcon token={{ symbol: source }} width={12} showChainIcon={false} className="h-3 w-3" />
      1.00
      <span className="px-0.5">=</span>
      <TokenIcon token={{ symbol: target }} width={12} showChainIcon={false} className="h-3 w-3" />
      {targetRate}
    </>
  );
}

/**
 * Editable body for the "Upgrade DAI/MKR" modal (Figma 1310:130711), mounted
 * as the shared modal's entry screen via `useModalEntryBody` — the upgrade
 * analogue of `StUsdsModalForm`. Amount block (label / balance, big input,
 * 25/50/100% chips, source-token dropdown) over the hairline-divided details
 * grid: Rate | You'll receive, Penalty (MKR only) | Network, Network fee.
 *
 * The MKR→SKY figures come from the immutable 1:24,000 contract rate net of
 * the governance fee (`useMkrSkyFee`) — the engine's calldata takes the raw
 * amount, so the preview math (`math.calculateConversion`) is display-only.
 * Analytics-free by design, following the stUSDS-modal precedent.
 */
export function UpgradeModalForm({
  sessionId,
  initialToken = 'DAI'
}: {
  sessionId: string;
  initialToken?: UpgradeSourceToken;
}) {
  const { address, isConnected } = useConnection();
  const chainId = useChainId();
  const chains = useChains();

  const [token, setToken] = useState<UpgradeSourceToken>(initialToken);
  const [value, setValue] = useState('');

  const amount = parseAmount(value);
  const debouncedAmount = useDebounce(amount);
  const debouncePending = debouncedAmount !== amount;

  const isMkr = token === 'MKR';
  const target = UPGRADE_TARGET[token];

  const sourceToken = isMkr ? TOKENS.mkr : TOKENS.dai;
  const { data: balance, refetch: refetchBalance } = useTokenBalance({
    address,
    token: sourceToken.address[chainId],
    chainId
  });

  const { data: mkrSkyFee } = useMkrSkyFee();
  const fee = isMkr ? (mkrSkyFee ?? 0n) : 0n;
  const receiveAmount = math.calculateConversion({ symbol: token }, debouncedAmount, fee);

  const insufficient = amount > 0n && balance !== undefined && amount > balance.value;
  const amountReady = isConnected && amount > 0n && !insufficient && !debouncePending;

  const { execute, steps, prepared, error, calls, isBatch } = useUpgradeLaunch({
    token,
    amount: debouncedAmount
  });

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee, error: networkFeeError } = useNetworkFee({
    calls,
    chainId,
    shouldUseBatch: isBatch,
    enabled: amountReady
  });

  const bundleState = useBundleFeeState(calls.length, networkFee, !!networkFeeError);
  const disabled = !amountReady || !prepared;

  // The wallet balance is chain state the engine's success doesn't refetch —
  // sync it so the entry screen shows the post-upgrade balance if revisited.
  const { txStatus } = useTransaction();
  useEffect(() => {
    if (txStatus === TxStatus.SUCCESS) refetchBalance();
  }, [txStatus, refetchBalance]);

  const amountLabel = `${formatAmount(debouncedAmount)} ${token}`;

  // Memoized on their data so the useModalEntryBody sync effect has stable
  // deps (the savings/stUSDS forms' convention).
  const toast = useMemo(
    () => ({
      loading: t`Upgrading ${amountLabel}`,
      success: t`${amountLabel} upgraded!`,
      error: t`Upgrade failed`
    }),
    [amountLabel]
  );

  // Wallet/status screen ("Confirm upgrade"): source → target amounts with
  // token chips above the Approve/Upgrade steps (Figma 1310:130657).
  const transactionScreenContent = useMemo(
    () => (
      <div className="flex flex-col gap-2" data-testid="upgrade-modal-summary">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <TokenIcon
              token={{ symbol: token }}
              width={28}
              showChainIcon={false}
              className="h-7 w-7 shrink-0"
            />
            <Text className="text-text truncate text-2xl font-medium" dataTestId="upgrade-modal-from-amount">
              {formatHeroAmount(debouncedAmount)}
            </Text>
          </span>
          <TokenChip symbol={token} />
        </div>
        {/* Icon SVGs don't inherit currentColor — fill must be set explicitly. */}
        <span aria-hidden className="pl-2">
          <ArrowDown width={10} height={14} className="fill-textSecondary" />
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <TokenIcon
              token={{ symbol: target }}
              width={28}
              showChainIcon={false}
              className="h-7 w-7 shrink-0"
            />
            <Text className="text-text truncate text-2xl font-medium" dataTestId="upgrade-modal-to-amount">
              {formatHeroAmount(receiveAmount)}
            </Text>
          </span>
          <TokenChip symbol={target} />
        </div>
      </div>
    ),
    [token, target, debouncedAmount, receiveAmount]
  );

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    steps,
    transactionScreenContent,
    toast
  });

  const networkName = chains.find(chain => chain.id === chainId)?.name ?? 'Ethereum';

  const setPercent = (percent: number) => {
    if (balance === undefined) return;
    setValue(formatUnits((balance.value * BigInt(percent)) / 100n, DECIMALS));
  };

  const percentButtons = isConnected && (
    <span className="flex items-center gap-1">
      {PERCENT_OPTIONS.map(percent => (
        // Design-system Button / Mini (Figma 5051:168712)
        <button
          key={percent}
          type="button"
          onClick={() => setPercent(percent)}
          data-testid={`upgrade-percent-${percent}`}
          className={cn(buttonVariants({ variant: 'mini', size: 'mini' }))}
        >
          {percent}%
        </button>
      ))}
    </span>
  );

  const hairline = <div className="bg-border h-px w-full" />;
  const columnDivider = <div className="bg-border h-6 w-px shrink-0" />;

  const body = (
    <div className="flex flex-col gap-4" data-testid="upgrade-modal-form">
      {/* Amount block (Figma Input / Amount): label / balance row, then the
          big input with the percent chips + source dropdown beside it — the
          chips drop to their own row below md (no mobile comp exists; this
          follows the ConvertAmountInput phone-tier adaptation). */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Text className="text-textSecondary text-xs">
            <Trans>Amount</Trans>
          </Text>
          <Text className="text-textSecondary text-xs" dataTestId="upgrade-modal-balance">
            <Trans>Balance</Trans>:{' '}
            {isConnected && balance !== undefined ? formatAmount(balance.value) : NO_VALUE}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <TokenIcon
            token={{ symbol: token }}
            width={24}
            showChainIcon={false}
            className="h-6 w-6 shrink-0"
          />
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={!isConnected}
            aria-label={t`Upgrade amount`}
            data-testid="upgrade-modal-amount-input"
            className="text-text placeholder:text-text w-full min-w-0 bg-transparent text-2xl leading-[26px] font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[32px] md:leading-9"
          />
          <span className="hidden shrink-0 items-center gap-4 md:flex">{percentButtons}</span>
          <UpgradeTokenSelect
            value={token}
            onChange={next => {
              setToken(next);
              setValue('');
            }}
          />
        </div>
        {percentButtons && <div className="flex md:hidden">{percentButtons}</div>}
      </div>
      {hairline}

      {insufficient && (
        <Text className="text-error text-sm" data-testid="upgrade-modal-amount-error">
          <Trans>Insufficient balance</Trans>
        </Text>
      )}

      {/* Details grid (Figma 1343:99468): hairline-divided rows of column pairs. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <DetailCell
            label={<Trans>Rate</Trans>}
            value={
              <RateValue
                source={token}
                target={target}
                targetRate={isMkr ? formatNumber(Number(math.MKR_TO_SKY_RATE), { maxDecimals: 2 }) : '1.00'}
              />
            }
            dataTestId="upgrade-modal-rate"
            className="flex-1"
          />
          {columnDivider}
          <DetailCell
            label={<Trans>You&apos;ll receive</Trans>}
            value={
              <>
                <TokenIcon token={{ symbol: target }} width={12} showChainIcon={false} className="h-3 w-3" />
                {formatAmount(receiveAmount)}
              </>
            }
            dataTestId="upgrade-modal-receive"
            className="flex-1"
          />
        </div>
        {hairline}
        <div className="flex items-center gap-4">
          {isMkr && (
            <>
              <DetailCell
                label={
                  <>
                    <Trans>Penalty</Trans>
                    <PopoverRateInfo type="delayedUpgradePenalty" />
                  </>
                }
                value={`${math.calculateUpgradePenalty(mkrSkyFee)}%`}
                dataTestId="upgrade-modal-penalty"
                className="flex-1"
              />
              {columnDivider}
            </>
          )}
          <DetailCell
            label={<Trans>Network</Trans>}
            value={
              <>
                {getChainIcon(chainId, 'h-3 w-3')}
                {networkName}
              </>
            }
            dataTestId="upgrade-modal-network"
            className="flex-1"
          />
        </div>
        {hairline}
        <DetailCell
          label={<NetworkFeeLabel />}
          value={<NetworkFeeValue fee={networkFee} state={bundleState} />}
          dataTestId="upgrade-modal-network-fee"
        />
      </div>

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}

      {error && amountReady && (
        <Text className="text-error text-sm" data-testid="upgrade-modal-error">
          <Trans>Something went wrong preparing the transaction. Please try again.</Trans>
        </Text>
      )}
    </div>
  );

  return renderInSlot(body);
}
