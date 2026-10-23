import { useCallback, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useChains, useConnection } from 'wagmi';
import { TOKENS, useAppChainId, useSafeWalletStatus, useTokenBalance } from '@/hooks';
import { normalizeDecimalSeparator } from '@/lib/amountInput';
import { familyMainnetId } from '@/utils/isTestnetId';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import {
  bridgeChainId,
  bridgeNetworkForChainId,
  getBridgeNetwork,
  guardChainId,
  type BridgeNetworkId
} from '../model/networks';
import { allowedDestinations, isLivePair, pickFrom, pickTo, type BridgePair } from '../model/pairs';
import { isValidRecipient, recipientProblem, recipientRequirement, sendsToOther } from '../model/recipient';
import { resolveBridgeRoute, type ResolvedBridgeRoute } from '../model/resolveRoute';
import { USDS_DECIMALS } from '../model/usds';
import { useAddressCode } from './useAddressCode';
import { useCctpGate } from './useCctpGate';
import { useNativeDepositGate } from './useNativeDepositGate';
import { useSafeConfig } from './useSafeConfig';

/** USDS balance of `address` on a bridge network the app can read; `value` is undefined otherwise. */
function useUsdsBalance(address: `0x${string}` | undefined, chainId: number | undefined) {
  const chains = useChains();
  const token = chainId === undefined ? undefined : TOKENS.usds.address[chainId];
  const readable = chainId !== undefined && chains.some(chain => chain.id === chainId);
  const { data, isLoading, refetch } = useTokenBalance({
    address,
    token,
    chainId: chainId ?? 0,
    enabled: readable && !!token
  });
  return readable && token
    ? { value: data?.value, isLoading, refetch }
    : { value: undefined, isLoading: false, refetch: undefined };
}

const AMOUNT_PATTERN = /^\d*\.?\d{0,18}$/;

const parseAmountOrZero = (value: string) => {
  if (value === '' || value === '.') return 0n;
  try {
    return parseUnits(value, USDS_DECIMALS);
  } catch {
    return 0n;
  }
};

/**
 * Form model for the Bridge tab: network pair, typed USDS amount, optional
 * recipient. Presentation-free — `BridgeCard` renders it and
 * `useBridgeLaunch` executes it.
 *
 * The source network follows the wallet on networks the app supports: picking
 * one asks the wallet to switch, and the form shows whatever the wallet lands
 * on. Avalanche and Solana (and app networks the current config can't switch
 * to, like L2s in the Tenderly dev setup) are held as a local pick and block
 * Review until their route tickets add them.
 */
export function useBridgeForm() {
  const { isConnected, address } = useConnection();
  const walletChainId = useAppChainId();
  const familyChainId = familyMainnetId(walletChainId);
  const safeStatus = useSafeWalletStatus();
  const isSafe = safeStatus === 'safe';
  const chains = useChains();
  const { canSwitchChain, handleSwitchChain } = useNetworkSwitch();

  const [sourceOverride, setSourceOverride] = useState<BridgeNetworkId | null>(null);
  const [pickedTo, setPickedTo] = useState<BridgeNetworkId>('base');
  const [value, setValue] = useState('');
  const [recipient, setRecipient] = useState<string | undefined>(undefined);

  const walletNetwork = bridgeNetworkForChainId(walletChainId) ?? 'ethereum';
  const from = sourceOverride ?? walletNetwork;
  const to = allowedDestinations(from).includes(pickedTo) ? pickedTo : allowedDestinations(from)[0];
  const pair: BridgePair = { from, to };

  const isConfiguredChain = (id: BridgeNetworkId) => {
    const target = getBridgeNetwork(id);
    return (
      target.appSupported && target.chainId !== undefined && chains.some(chain => chain.id === target.chainId)
    );
  };

  const moveSource = (next: BridgeNetworkId) => {
    const target = getBridgeNetwork(next);
    if (isConfiguredChain(next) && canSwitchChain && target.chainId !== undefined) {
      setSourceOverride(null);
      if (next !== walletNetwork) handleSwitchChain({ chainId: target.chainId });
      return;
    }
    setSourceOverride(next === walletNetwork ? null : next);
  };

  const applyPair = (next: BridgePair) => {
    // A wallet the app can't switch (Safe) keeps its network as the source.
    if (next.from !== from && !canSwitchChain) return;
    // A recipient typed for one address family can't carry over to another.
    if (getBridgeNetwork(next.to).family !== getBridgeNetwork(to).family) setRecipient(undefined);
    setPickedTo(next.to);
    if (next.from !== from) moveSource(next.from);
  };

  const selectFrom = (next: BridgeNetworkId) => applyPair(pickFrom(pair, next));
  const selectTo = (next: BridgeNetworkId) => applyPair(pickTo(pair, next));
  const flip = () => selectFrom(to);

  const onInput = useCallback((raw: string) => {
    const typed = normalizeDecimalSeparator(raw);
    if (AMOUNT_PATTERN.test(typed)) setValue(typed);
  }, []);

  const sourceChainId = bridgeChainId(from, familyChainId);
  const destinationChainId = bridgeChainId(to, familyChainId);
  const source = useUsdsBalance(isConnected ? address : undefined, sourceChainId);
  const sourceBalance = source.value;
  const destination = useUsdsBalance(isConnected ? address : undefined, destinationChainId);
  const destinationBalance = destination.value;
  const { refetch: refetchSource } = source;
  const { refetch: refetchDestination } = destination;
  const refetchBalances = useCallback(() => {
    refetchSource?.();
    refetchDestination?.();
  }, [refetchSource, refetchDestination]);

  const setPercent = useCallback(
    (percent: number) => {
      if (sourceBalance === undefined) return;
      setValue(formatUnits((sourceBalance * BigInt(percent)) / 100n, USDS_DECIMALS));
    },
    [sourceBalance]
  );

  const amount = useMemo(() => parseAmountOrZero(value), [value]);
  const nativeGate = useNativeDepositGate({ from, to, chainId: sourceChainId });
  const cctpGate = useCctpGate({
    from,
    to,
    sourceChainId,
    ethereumChainId: bridgeChainId('ethereum', familyChainId)
  });
  // The other route facts (LayerZero, withdrawals) come from their tickets, through toRouteFact.
  const resolved = useMemo((): ResolvedBridgeRoute => {
    if (!isLivePair({ from, to })) return { status: 'blocked', reason: 'pair-not-allowed' };
    // With no gate the resolver reads CCTP as open.
    if (from !== 'ethereum' && cctpGate === undefined)
      return { status: 'blocked', reason: 'pair-not-allowed' };
    const result = resolveBridgeRoute({ from, to, amount, facts: { native: nativeGate, cctp: cctpGate } });
    // The native withdrawal has no real calls yet (APP-617), so an L2 bridges by CCTP only.
    if (result.status === 'ok' && from !== 'ethereum' && result.route.kind !== 'cctp')
      return { status: 'blocked', reason: result.route.fallbackReason ?? 'closed' };
    return result;
  }, [from, to, amount, nativeGate, cctpGate]);
  const route = resolved.status === 'ok' ? resolved.route : undefined;
  const isZero = amount === 0n;
  const insufficient = isConnected && sourceBalance !== undefined && amount > sourceBalance;

  const destinationFamily = getBridgeNetwork(to).family;
  // The destination can change under a saved recipient (the source follows the wallet).
  const recipientInvalid = !!recipient && !isValidRecipient(recipient, destinationFamily);
  const checkSafe = isConnected && isSafe && destinationFamily === 'evm' && !sendsToOther(recipient, address);
  const sourceSafe = useSafeConfig({ address, chainId: sourceChainId, enabled: checkSafe });
  const destinationSafe = useSafeConfig({ address, chainId: destinationChainId, enabled: checkSafe });
  // The address the destination pays: a typed recipient, else the wallet.
  const typedOther = sendsToOther(recipient, address);
  const payee =
    destinationFamily !== 'evm' || recipientInvalid ? undefined : typedOther ? recipient : address;
  const payeeOnSource = useAddressCode({ address: payee, chainId: sourceChainId });
  const payeeOnDestination = useAddressCode({ address: payee, chainId: destinationChainId });
  const payeeCode = { source: payeeOnSource.code, destination: payeeOnDestination.code };
  const recipientRule = recipientRequirement({
    destinationFamily,
    sender: address,
    recipient,
    safe: isSafe ? { source: sourceSafe.lookup, destination: destinationSafe.lookup } : undefined,
    code: payeeCode
  });
  const problem = typedOther && payee ? recipientProblem(payee, payeeCode) : undefined;
  const codeChecking = payeeOnSource.isChecking || payeeOnDestination.isChecking;

  const balanceLoading = isConnected && source.isLoading;
  // An unread balance (failed, or a network the app can't read) never passes as enough.
  const balanceUnknown = isConnected && !balanceLoading && sourceBalance === undefined;
  const sourceUnavailable =
    guardChainId({ network: from, familyChainId, chainIds: chains.map(chain => chain.id) }) === undefined;
  // Recording and the recipient rule both depend on whether the wallet is a Safe.
  const walletUnchecked = isConnected && (safeStatus === 'checking' || safeStatus === 'unknown');

  return {
    from,
    to,
    /** The source can't be changed: the wallet can't be switched by the app (Safe). */
    isSourceStatic: !canSwitchChain,
    /** The flipped pair has a live route. */
    canFlip: isLivePair({ from: to, to: from }),
    value,
    amount,
    route,
    /** Why no route can take this bridge right now. */
    blockedReason: resolved.status === 'blocked' ? resolved.reason : undefined,
    recipient,
    sourceBalance,
    destinationBalance,
    isConnected,
    isZero,
    insufficient,
    /** The source balance is still loading, so `insufficient` can't be trusted yet. */
    balanceLoading,
    /** The source balance couldn't be read. */
    balanceUnknown,
    /** The app can't switch to the source network, so it can't run the source legs. */
    sourceUnavailable,
    /** The saved recipient is not a valid address on the destination network. */
    recipientInvalid,
    /** Why the destination can't deliver to the typed recipient. */
    recipientProblem: problem,
    needsRecipient: recipientRule.required,
    /** The lookups behind `needsRecipient` and `recipientProblem` are still in flight. */
    recipientChecking: codeChecking || (checkSafe && (sourceSafe.isChecking || destinationSafe.isChecking)),
    recipientReason: recipientRule.required ? recipientRule.reason : undefined,
    /** The wallet is a contract on the source and the destination pays it, not a typed recipient. */
    senderIsContract: isConnected && !typedOther && payeeOnSource.code === 'contract',
    /** The Safe check failed, so the wallet type is unknown. */
    safeCheckFailed: isConnected && safeStatus === 'unknown',
    /** Review and Confirm can't go ahead; only meaningful while connected. */
    reviewBlocked:
      isZero ||
      insufficient ||
      balanceLoading ||
      balanceUnknown ||
      sourceUnavailable ||
      recipientInvalid ||
      !!problem ||
      recipientRule.required ||
      walletUnchecked ||
      !route,
    selectFrom,
    selectTo,
    flip,
    onInput,
    setPercent,
    setRecipient,
    /** Rereads both balances, after a send moved the source funds. */
    refetchBalances,
    reset: () => setValue('')
  };
}

export type BridgeFormModel = ReturnType<typeof useBridgeForm>;
