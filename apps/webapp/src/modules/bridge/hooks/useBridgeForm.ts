import { useCallback, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useChains, useConnection } from 'wagmi';
import { useAppChainId, useSafeWalletStatus, useTokenBalance, usdsAddress, usdsL2Address } from '@/hooks';
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
import { allowedDestinations, pickFrom, pickTo, type BridgePair } from '../model/pairs';
import { recipientRequirement, sendsToOther } from '../model/recipient';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { useSafeConfig } from './useSafeConfig';

export const USDS_DECIMALS = 18;

const usdsTokenAddress = (network: BridgeNetworkId, chainId: number | undefined) => {
  if (chainId === undefined) return undefined;
  const addresses: Record<number, `0x${string}`> = network === 'ethereum' ? usdsAddress : usdsL2Address;
  return addresses[chainId];
};

/** USDS balance of `address` on a bridge network the app can read; `value` is undefined otherwise. */
function useUsdsBalance(
  address: `0x${string}` | undefined,
  network: BridgeNetworkId,
  chainId: number | undefined
) {
  const chains = useChains();
  const token = usdsTokenAddress(network, chainId);
  const readable = chainId !== undefined && chains.some(chain => chain.id === chainId);
  const { data, isLoading } = useTokenBalance({
    address,
    token,
    chainId: chainId ?? 0,
    enabled: readable && !!token
  });
  return readable && token ? { value: data?.value, isLoading } : { value: undefined, isLoading: false };
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

  const selectFrom = (next: BridgeNetworkId) => {
    const nextPair = pickFrom(pair, next);
    setPickedTo(nextPair.to);
    // A recipient typed for one address family can't carry over to another.
    if (getBridgeNetwork(nextPair.to).family !== getBridgeNetwork(to).family) setRecipient(undefined);
    const target = getBridgeNetwork(next);
    if (isConfiguredChain(next) && canSwitchChain && target.chainId !== undefined) {
      setSourceOverride(null);
      if (next !== walletNetwork) handleSwitchChain({ chainId: target.chainId });
      return;
    }
    setSourceOverride(next === walletNetwork ? null : next);
  };

  const selectTo = (next: BridgeNetworkId) => {
    const nextPair = pickTo(pair, next);
    if (getBridgeNetwork(nextPair.to).family !== getBridgeNetwork(to).family) setRecipient(undefined);
    setPickedTo(nextPair.to);
    if (nextPair.from !== from) selectFrom(nextPair.from);
  };

  const flip = () => selectFrom(to);

  const onInput = useCallback((raw: string) => {
    const typed = normalizeDecimalSeparator(raw);
    if (AMOUNT_PATTERN.test(typed)) setValue(typed);
  }, []);

  const sourceChainId = bridgeChainId(from, familyChainId);
  const destinationChainId = bridgeChainId(to, familyChainId);
  const source = useUsdsBalance(isConnected ? address : undefined, from, sourceChainId);
  const sourceBalance = source.value;
  const destinationBalance = useUsdsBalance(isConnected ? address : undefined, to, destinationChainId).value;

  const setPercent = useCallback(
    (percent: number) => {
      if (sourceBalance === undefined) return;
      setValue(formatUnits((sourceBalance * BigInt(percent)) / 100n, USDS_DECIMALS));
    },
    [sourceBalance]
  );

  const amount = useMemo(() => parseAmountOrZero(value), [value]);
  // Route facts (open/paused, limits, liquidity, fee quote) come from the route tickets.
  const resolved = useMemo(() => resolveBridgeRoute({ from, to, amount, facts: {} }), [from, to, amount]);
  const route = resolved.status === 'ok' ? resolved.route : undefined;
  const isZero = amount === 0n;
  const insufficient = isConnected && sourceBalance !== undefined && amount > sourceBalance;

  const destinationFamily = getBridgeNetwork(to).family;
  const checkSafe = isConnected && isSafe && destinationFamily === 'evm' && !sendsToOther(recipient, address);
  const sourceSafe = useSafeConfig({ address, chainId: sourceChainId, enabled: checkSafe });
  const destinationSafe = useSafeConfig({ address, chainId: destinationChainId, enabled: checkSafe });
  const recipientRule = recipientRequirement({
    destinationFamily,
    sender: address,
    recipient,
    safe: isSafe ? { source: sourceSafe.lookup, destination: destinationSafe.lookup } : undefined
  });

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
    needsRecipient: recipientRule.required,
    /** The Safe lookups behind `needsRecipient` are still in flight. */
    recipientChecking: checkSafe && (sourceSafe.isChecking || destinationSafe.isChecking),
    recipientReason: recipientRule.required ? recipientRule.reason : undefined,
    /** The Safe check failed, so the wallet type is unknown. */
    safeCheckFailed: isConnected && safeStatus === 'unknown',
    /** Review and Confirm can't go ahead; only meaningful while connected. */
    reviewBlocked:
      isZero ||
      insufficient ||
      balanceLoading ||
      balanceUnknown ||
      sourceUnavailable ||
      recipientRule.required ||
      walletUnchecked ||
      !route,
    selectFrom,
    selectTo,
    flip,
    onInput,
    setPercent,
    setRecipient,
    reset: () => setValue('')
  };
}

export type BridgeFormModel = ReturnType<typeof useBridgeForm>;
