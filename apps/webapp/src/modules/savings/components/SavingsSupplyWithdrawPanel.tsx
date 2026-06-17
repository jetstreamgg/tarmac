import { useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { TOKENS, useTokenBalance, useSavingsData } from '@/hooks';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';

const NO_VALUE = '–';

// Parse the raw input to an 18-decimal bigint; partial/invalid input → 0.
function parseAmount(value: string): bigint {
  if (!value) return 0n;
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}

/**
 * Inline supply/withdraw input for the redesigned Savings detail page (D3).
 * Replaces "Supply/Withdraw opens a modal hosting the legacy SavingsWidget" —
 * amount entry and the supply/withdraw choice happen inline, and confirming hands
 * off to the shared review modal via `useSavingsLaunch().launch()`.
 *
 * Mainnet USDS only: supply draws from the wallet USDS balance, withdraw from the
 * savings position. A withdraw "Max" flags the engine to redeem the whole
 * position via `maxWithdraw(owner)` (no dust), rather than passing a stale
 * displayed balance. L2 PSM stays on the legacy widget until the L2 slices.
 */
export function SavingsSupplyWithdrawPanel({ onSuccess }: { onSuccess?: () => void }) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const usds = TOKENS.usds;
  const { data: walletBalance } = useTokenBalance({ address, chainId, token: usds.address[chainId] });
  const { data: savingsData } = useSavingsData();

  const [flow, setFlow] = useState<SavingsLaunchFlow>('supply');
  const [value, setValue] = useState('');
  const [max, setMax] = useState(false);

  const isSupply = flow === 'supply';
  const amount = parseAmount(value);

  // Supply draws from the wallet USDS balance; withdraw from the savings position.
  const sourceBalance = isSupply ? (walletBalance?.value ?? 0n) : (savingsData?.userSavingsBalance ?? 0n);
  const isZero = amount === 0n;
  const insufficient = isConnected && !max && amount > sourceBalance;

  const { launch, prepared } = useSavingsLaunch({
    flow,
    originToken: usds,
    amount,
    // `max` only applies to withdraw — it routes the engine to maxWithdraw(owner).
    max: !isSupply && max,
    transactionContent: (
      <div className="flex items-center gap-2 py-1" data-testid="savings-tx-preview">
        <TokenIcon className="h-6 w-6" token={{ symbol: 'USDS' }} showChainIcon={false} />
        <Text>{value || '0'}</Text>
        <Text>USDS</Text>
      </div>
    ),
    onSuccess: () => {
      setValue('');
      setMax(false);
      onSuccess?.();
    }
  });

  const disabled = !isConnected || !prepared || (!max && (isZero || insufficient));

  const switchFlow = (next: SavingsLaunchFlow) => {
    setFlow(next);
    setValue('');
    setMax(false);
  };

  const onInput = (raw: string) => {
    setValue(raw.replace(/[^0-9.]/g, ''));
    // Typing overrides a previous max selection.
    setMax(false);
  };

  const setMaxAmount = () => {
    setValue(formatUnits(sourceBalance, 18));
    // Flag a max only for withdraw; supply just deposits exactly the input.
    setMax(!isSupply);
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-medium ${active ? 'bg-background text-text' : 'text-textSecondary'}`;

  return (
    <div className="flex flex-col gap-3" data-testid="savings-supply-withdraw-panel">
      <div className="bg-panel flex gap-1 rounded-xl p-1">
        <button
          type="button"
          onClick={() => switchFlow('supply')}
          aria-pressed={isSupply}
          data-testid="savings-tab-supply"
          className={tabClass(isSupply)}
        >
          <Trans>Supply</Trans>
        </button>
        <button
          type="button"
          onClick={() => switchFlow('withdraw')}
          aria-pressed={!isSupply}
          data-testid="savings-tab-withdraw"
          className={tabClass(!isSupply)}
        >
          <Trans>Withdraw</Trans>
        </button>
      </div>

      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="savings-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <TokenIcon token={{ symbol: 'USDS' }} width={20} showChainIcon={false} className="h-5 w-5" />
          <Text className="font-medium">USDS</Text>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Text className="text-textSecondary text-sm">
          <Trans>Balance</Trans>:{' '}
          {isConnected
            ? formatNumber(parseFloat(formatUnits(sourceBalance, 18)), { maxDecimals: 2 })
            : NO_VALUE}
        </Text>
        <button
          type="button"
          onClick={setMaxAmount}
          className="text-textEmphasis text-sm font-medium"
          data-testid="savings-amount-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="savings-amount-error">
          {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
        </Text>
      )}

      <Button
        variant="primary"
        disabled={disabled}
        onClick={launch}
        data-testid={isSupply ? 'position-supply' : 'position-withdraw'}
      >
        {isSupply ? <Trans>Supply</Trans> : <Trans>Withdraw</Trans>}
      </Button>
    </div>
  );
}
