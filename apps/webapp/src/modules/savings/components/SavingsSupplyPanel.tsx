import { useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { TOKENS, useTokenBalance } from '@/hooks';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSavingsLaunch } from '../hooks/useSavingsLaunch';

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
 * Inline supply input for the redesigned Savings detail page (D3). Replaces
 * "Supply opens a modal hosting the legacy SavingsWidget" — amount entry happens
 * inline and confirming hands off to the shared review modal via
 * `useSavingsLaunch().launch()`. Mainnet USDS only for slice 01.
 */
export function SavingsSupplyPanel({ onSuccess }: { onSuccess?: () => void }) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const usds = TOKENS.usds;
  const { data: balance } = useTokenBalance({ address, chainId, token: usds.address[chainId] });

  const [value, setValue] = useState('');

  const amount = parseAmount(value);
  const balanceValue = balance?.value ?? 0n;
  const isZero = amount === 0n;
  const insufficient = isConnected && amount > balanceValue;

  const { launch, prepared } = useSavingsLaunch({
    flow: 'supply',
    originToken: usds,
    amount,
    transactionContent: (
      <div className="flex items-center gap-2 py-1" data-testid="savings-supply-preview">
        <TokenIcon className="h-6 w-6" token={{ symbol: 'USDS' }} showChainIcon={false} />
        <Text>{value || '0'}</Text>
        <Text>USDS</Text>
      </div>
    ),
    onSuccess: () => {
      setValue('');
      onSuccess?.();
    }
  });

  const disabled = !isConnected || isZero || insufficient || !prepared;

  const setMax = () => {
    if (balance?.value !== undefined) setValue(formatUnits(balance.value, 18));
  };

  return (
    <div className="flex flex-col gap-3" data-testid="savings-supply-panel">
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          aria-label={t`Supply amount`}
          data-testid="savings-supply-input"
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
          {balance ? formatNumber(parseFloat(formatUnits(balance.value, 18)), { maxDecimals: 2 }) : NO_VALUE}
        </Text>
        <button
          type="button"
          onClick={setMax}
          className="text-textEmphasis text-sm font-medium"
          data-testid="savings-supply-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="savings-supply-error">
          <Trans>Insufficient balance</Trans>
        </Text>
      )}

      <Button variant="primary" disabled={disabled} onClick={launch} data-testid="position-supply">
        <Trans>Supply</Trans>
      </Button>
    </div>
  );
}
