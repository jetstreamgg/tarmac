import { useMemo } from 'react';
import { useChains, useConnection } from 'wagmi';
import { getAddress } from 'viem';
import { useSafeWalletStatus, useTokenBalance } from '@/hooks';
import { useAppChainId } from '@/hooks/ui/useAppChainId';
import { math } from '@/utils';
import { familyMainnetId } from '@/utils/isTestnetId';
import { cctpL2Contracts } from '../adapters/cctp/contracts';
import { guardChainId } from '../model/networks';
import { sendsToOther } from '../model/recipient';
import { resolveBridgeRoute, type BridgeBlockReason } from '../model/resolveRoute';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import type { BridgeLaunchForm } from './useBridgeLaunch';
import { useCctpGate } from './useCctpGate';

export type CctpResumeBlockReason =
  | BridgeBlockReason
  | 'source-unavailable'
  | 'wallet-checking'
  | 'wallet-unknown'
  | 'balance-loading'
  | 'balance-unknown'
  | 'insufficient';

/**
 * The bridge form that continues an unfinished CCTP swap: the burn of that
 * swap's USDC to the recipient it was for. Only CCTP can take it; any gate
 * problem blocks it, with no native fallback. With no swap it stays blocked
 * and reads nothing.
 */
export function useCctpResumeForm(swap: UnfinishedCctpSwap | undefined): {
  form: BridgeLaunchForm;
  blockedReason: CctpResumeBlockReason | undefined;
} {
  const { isConnected, address } = useConnection();
  const familyChainId = familyMainnetId(useAppChainId());
  const chainIds = useChains().map(chain => chain.id);
  const safeStatus = useSafeWalletStatus();
  // Any network while there is no swap; the gate reads nothing for Ethereum.
  const from = swap?.network ?? 'base';
  const sourceChainId = guardChainId({ network: from, familyChainId, chainIds });
  const ethereumChainId = guardChainId({ network: 'ethereum', familyChainId, chainIds });
  const cctp = useCctpGate({
    from: swap ? from : 'ethereum',
    to: 'ethereum',
    sourceChainId,
    ethereumChainId,
    swap: false
  });
  const usdc = useTokenBalance({
    address,
    token: cctpL2Contracts(from).usdc,
    chainId: sourceChainId ?? 0,
    enabled: !!swap && sourceChainId !== undefined
  });
  const usdcAmount = swap?.usdcAmount ?? 0n;
  const amount = math.convertUSDCtoWad(usdcAmount);

  const resolved = useMemo(() => {
    // With no gate the resolver reads CCTP as open.
    if (cctp === undefined) return { route: undefined, reason: 'pair-not-allowed' as const };
    const result = resolveBridgeRoute({ from, to: 'ethereum', amount, facts: { cctp } });
    if (result.status === 'blocked') return { route: undefined, reason: result.reason };
    // The swap's USDC can only go through CCTP.
    if (result.route.kind !== 'cctp')
      return { route: undefined, reason: result.route.fallbackReason ?? ('closed' as const) };
    return { route: result.route, reason: undefined };
  }, [cctp, from, amount]);

  const blockedReason: CctpResumeBlockReason | undefined =
    sourceChainId === undefined
      ? 'source-unavailable'
      : safeStatus === 'checking'
        ? 'wallet-checking'
        : safeStatus === 'unknown'
          ? 'wallet-unknown'
          : usdc.isLoading
            ? 'balance-loading'
            : usdc.data === undefined
              ? 'balance-unknown'
              : usdc.data.value < usdcAmount
                ? 'insufficient'
                : resolved.reason;

  return {
    form: {
      amount,
      from,
      to: 'ethereum',
      route: swap && resolved.route,
      recipient: swap && sendsToOther(swap.recipient, address) ? getAddress(swap.recipient) : undefined,
      isConnected,
      reviewBlocked: !swap || blockedReason !== undefined
    },
    blockedReason: swap && blockedReason
  };
}
