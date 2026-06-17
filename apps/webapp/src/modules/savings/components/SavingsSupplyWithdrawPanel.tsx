import { useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { TOKENS, useTokenBalance, useSavingsData, getTokenDecimals, type Token } from '@/hooks';
import { formatBigInt, formatNumber, isL2ChainId } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsSupplyMinAmountOut } from '../hooks/useSavingsSupplyMinAmountOut';

const NO_VALUE = '–';

// Supply origin tokens. DAI (mainnet) routes useSavingsLaunch to the
// upgrade-and-supply engine (DAI → USDS → deposit); USDC (L2) routes to the PSM
// swap. Withdraw is always USDS.
type OriginSymbol = 'USDS' | 'DAI' | 'USDC';
const ORIGIN_TOKENS: Record<OriginSymbol, Token> = {
  USDS: TOKENS.usds,
  DAI: TOKENS.dai,
  USDC: TOKENS.usdc
};
const MAINNET_SUPPLY_ORIGINS: OriginSymbol[] = ['USDS', 'DAI'];
const L2_SUPPLY_ORIGINS: OriginSymbol[] = ['USDS', 'USDC'];

// Parse the raw input to a bigint at the origin token's decimals (USDC is 6 on
// L2); partial/invalid input → 0.
function parseAmount(value: string, decimals: number): bigint {
  if (!value) return 0n;
  try {
    return parseUnits(value, decimals);
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
 * Mainnet only: supply draws from the wallet balance of the selected origin token
 * (USDS or DAI — DAI upgrades to USDS then deposits), withdraw from the savings
 * position. A withdraw "Max" flags the engine to redeem the whole position via
 * `maxWithdraw(owner)` (no dust), rather than passing a stale displayed balance.
 * L2 PSM stays on the legacy widget until the L2 slices.
 */
export function SavingsSupplyWithdrawPanel({ onSuccess }: { onSuccess?: () => void }) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const { data: savingsData } = useSavingsData();

  const isL2 = isL2ChainId(chainId);
  const [flow, setFlow] = useState<SavingsLaunchFlow>('supply');
  const [originSymbol, setOriginSymbol] = useState<OriginSymbol>('USDS');
  const [value, setValue] = useState('');
  const [max, setMax] = useState(false);

  const isSupply = flow === 'supply';
  // DAI (mainnet) / USDC (L2) origins apply to supply only; withdraw is USDS.
  const supplyOrigins = isL2 ? L2_SUPPLY_ORIGINS : MAINNET_SUPPLY_ORIGINS;
  const originToken = isSupply ? ORIGIN_TOKENS[originSymbol] : TOKENS.usds;
  const originDecimals = getTokenDecimals(originToken, chainId);
  const amount = parseAmount(value, originDecimals);

  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: originToken.address[chainId]
  });

  // L2 PSM supply slippage floor (chi-projected sUSDS out). The orchestrator hands
  // this straight to the engine; it's ignored on the mainnet / withdraw paths.
  const minAmountOut = useSavingsSupplyMinAmountOut({ amount, originToken });

  // Supply draws from the origin token's wallet balance; withdraw from the position.
  const sourceBalance = isSupply ? (walletBalance?.value ?? 0n) : (savingsData?.userSavingsBalance ?? 0n);
  const isZero = amount === 0n;
  const insufficient = isConnected && !max && amount > sourceBalance;

  const { launch, prepared } = useSavingsLaunch({
    flow,
    originToken,
    amount,
    // `max` only applies to withdraw — it routes the engine to maxWithdraw(owner).
    max: !isSupply && max,
    referralCode: REFERRAL_CODE,
    minAmountOut,
    transactionContent: (
      <div className="flex items-center gap-2 py-1" data-testid="savings-tx-preview">
        <TokenIcon className="h-6 w-6" token={{ symbol: originToken.symbol }} showChainIcon={false} />
        <Text>{value || '0'}</Text>
        <Text>{originToken.symbol}</Text>
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
    // Withdraw is USDS-only; reset the origin so re-entering supply starts on USDS.
    setOriginSymbol('USDS');
    setValue('');
    setMax(false);
  };

  const switchOrigin = (next: OriginSymbol) => {
    setOriginSymbol(next);
    setValue('');
    setMax(false);
  };

  const onInput = (raw: string) => {
    setValue(raw.replace(/[^0-9.]/g, ''));
    // Typing overrides a previous max selection.
    setMax(false);
  };

  const setMaxAmount = () => {
    setValue(formatUnits(sourceBalance, originDecimals));
    // Flag a max only for withdraw; supply just deposits exactly the input.
    setMax(!isSupply);
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-medium ${active ? 'bg-background text-text' : 'text-textSecondary'}`;

  const originClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
      active ? 'bg-background text-text' : 'text-textSecondary'
    }`;

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

      {/* Supply origin token: USDS deposits/swaps directly; DAI upgrades to USDS
          first (mainnet); USDC swaps through the PSM (L2). */}
      {isSupply && (
        <div className="flex items-center gap-1" data-testid="savings-origin-select">
          {supplyOrigins.map(symbol => (
            <button
              key={symbol}
              type="button"
              onClick={() => switchOrigin(symbol)}
              aria-pressed={originSymbol === symbol}
              data-testid={`savings-origin-${symbol.toLowerCase()}`}
              className={originClass(originSymbol === symbol)}
            >
              <TokenIcon token={{ symbol }} width={18} showChainIcon={false} className="h-[18px] w-[18px]" />
              {symbol}
            </button>
          ))}
        </div>
      )}

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
          <TokenIcon
            token={{ symbol: originToken.symbol }}
            width={20}
            showChainIcon={false}
            className="h-5 w-5"
          />
          <Text className="font-medium">{originToken.symbol}</Text>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Text className="text-textSecondary text-sm">
          <Trans>Balance</Trans>:{' '}
          {isConnected
            ? formatNumber(parseFloat(formatUnits(sourceBalance, originDecimals)), { maxDecimals: 2 })
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

      {/* L2 PSM supply surfaces the slippage floor (min sUSDS out). */}
      {isL2 && isSupply && !isZero && (
        <div className="flex items-center justify-between" data-testid="savings-min-amount-out">
          <Text className="text-textSecondary text-sm">
            <Trans>Receive at least</Trans>
          </Text>
          <Text className="text-text text-sm font-medium">
            {formatBigInt(minAmountOut, { unit: 18, maxDecimals: 2 })} sUSDS
          </Text>
        </div>
      )}

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
