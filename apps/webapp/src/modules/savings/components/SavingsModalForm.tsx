import { useCallback, useEffect, useRef, useState } from 'react';
import { useChainId, useChains, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { TOKENS, useSavingsData, useTokenBalance } from '@/hooks';
import { formatNumber, formatPercent } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { buildSupplyModalRows, buildWithdrawModalRows, type SavingsModalRow } from './savingsModalRows';

const NO_VALUE = '–';
const USDS_DECIMALS = 18;

const formatUsds = (value: bigint) =>
  `${formatNumber(parseFloat(formatUnits(value, USDS_DECIMALS)), { maxDecimals: 2 })} USDS`;

function ModalRow({ row }: { row: SavingsModalRow }) {
  return (
    <div className="flex items-center justify-between" data-testid={`savings-modal-row-${row.label}`}>
      <Text className="text-textSecondary text-sm">{row.label}</Text>
      {row.kind === 'single' ? (
        <Text className="text-text text-sm font-medium">{row.value}</Text>
      ) : (
        <span className="text-text flex items-center gap-1.5 text-sm font-medium">
          <Text className="text-textSecondary text-sm">{row.before}</Text>
          <span aria-hidden className="text-textSecondary">
            →
          </span>
          <Text className="text-text text-sm font-medium">{row.after}</Text>
        </span>
      )}
    </div>
  );
}

/**
 * Editable body for the has-position "Supply to / Withdraw from Sky Savings" modals
 * (Figma 527:7591 / 527:10945), mounted as the shared modal's `entry.content`. One
 * body, two flows (`flow`) — the single component the PRD calls for (module 2).
 * Mainnet USDS only — slice 04 injects the USDS/DAI origin dropdown, slice 05 the
 * L2 PSM affordances.
 *
 * It owns its amount/max state and renders the input + Max + the flow's before→after
 * rows. The shared modal owns the confirm button; this body keeps that button's
 * gating + handler live via `updateModalContent`, which *merges* into the entry (so
 * this `content` is never re-pushed and the body never remounts — keeping the input
 * focused and loop-free). Confirm fires the engine `execute` from `useSavingsLaunch`
 * directly (the modal is already open, so there is no separate review screen) —
 * calldata is identical to the inline/launch path.
 *
 * Supply spends the wallet USDS balance; withdraw spends the savings position, and
 * its Max sets the `max` flag so the engine redeems via `maxWithdraw(owner)` with no
 * dust (the UI never computes the redeem amount).
 */
export function SavingsModalForm({ sessionId, flow }: { sessionId: string; flow: SavingsLaunchFlow }) {
  const isSupply = flow === 'supply';
  const chainId = useChainId();
  const chains = useChains();
  const { address, isConnected } = useConnection();
  const { data: savingsData } = useSavingsData();
  const { updateModalContent } = useTransaction();

  const [value, setValue] = useState('');
  // Withdraw-only: set by Max so the engine redeems the whole position via
  // maxWithdraw(owner) (no dust). Cleared the moment the user edits the amount.
  const [max, setMax] = useState(false);

  const amount = parseAmount(value);
  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: TOKENS.usds.address[chainId]
  });
  const walletBalanceValue = walletBalance?.value ?? 0n;
  const position = savingsData?.userSavingsBalance ?? 0n;
  // Supply is capped by the wallet USDS balance; withdraw by the savings position.
  const available = isSupply ? walletBalanceValue : position;
  const isZero = amount === 0n;
  const insufficient = isConnected && amount > available;

  const { execute, steps, prepared } = useSavingsLaunch({
    flow,
    originToken: TOKENS.usds,
    amount,
    max: !isSupply && max,
    referralCode: REFERRAL_CODE
  });

  const disabled = !isConnected || !prepared || isZero || insufficient;

  // The modal's confirm calls this. `execute` is rebuilt every render (its calls
  // array is fresh each time), so pushing it directly would loop the sync below;
  // instead a stable handler reads the latest `execute` from a ref kept current in
  // an effect — so `onConfirm` need never be re-pushed.
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);
  const onConfirm = useCallback(() => executeRef.current(), []);

  // Keep the shared modal's confirm gating + handler + step labels in sync. Merged
  // (not replacing `content`), so the body never remounts; bounded to amount-driven
  // state changes (disabled / steps), so it can't loop on provider re-renders.
  useEffect(() => {
    updateModalContent(sessionId, { entry: { confirmDisabled: disabled }, onConfirm, steps });
  }, [sessionId, disabled, steps, onConfirm, updateModalContent]);

  const onInput = (raw: string) => {
    setMax(false);
    setValue(raw.replace(/[^0-9.]/g, ''));
  };
  const setMaxAmount = () => {
    if (!isSupply) setMax(true);
    setValue(formatUnits(available, USDS_DECIMALS));
  };

  const networkName = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';
  const savingsRate = savingsData ? formatPercent(savingsData.savingsRate) : NO_VALUE;
  const rows = isSupply
    ? buildSupplyModalRows({
        savingsRate,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position + amount),
        // 1Y est. earnings has no projection source yet (PRD Out of Scope) — stubbed.
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        network: networkName,
        networkFee: NO_VALUE
      })
    : buildWithdrawModalRows({
        // Rate is unchanged by a withdrawal, but Figma 527:10945 draws it as a delta.
        savingsRateBefore: savingsRate,
        savingsRateAfter: savingsRate,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position > amount ? position - amount : 0n),
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        network: networkName,
        networkFee: NO_VALUE
      });

  return (
    <div className="flex flex-col gap-3" data-testid={`savings-modal-${flow}-form`}>
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          disabled={!isConnected}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="savings-modal-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
            ? formatNumber(parseFloat(formatUnits(available, USDS_DECIMALS)), { maxDecimals: 2 })
            : NO_VALUE}
        </Text>
        <button
          type="button"
          onClick={setMaxAmount}
          className="text-textEmphasis text-sm font-medium"
          data-testid="savings-modal-amount-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="savings-modal-amount-error">
          <Trans>Insufficient balance</Trans>
        </Text>
      )}

      <div className="flex flex-col gap-3 pt-1">
        {rows.map(row => (
          <ModalRow key={row.label} row={row} />
        ))}
      </div>
    </div>
  );
}

// Parse the raw USDS input (18 decimals) to a bigint; partial/invalid → 0.
function parseAmount(raw: string): bigint {
  if (!raw) return 0n;
  try {
    return parseUnits(raw, USDS_DECIMALS);
  } catch {
    return 0n;
  }
}
