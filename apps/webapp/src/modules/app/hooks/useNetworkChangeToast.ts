import { useEffect, useEffectEvent, useState } from 'react';
import { useAccount, useChainId, useChains } from 'wagmi';
import { Intent } from '@/lib/enums';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useEnhancedNetworkToast } from './useEnhancedNetworkToast';

/**
 * Shell-level network-change feedback (previously owned by WidgetNavigation):
 * shows the network toast when the chain changes, and clears the
 * switching/auto-switching flags once the change completes or the wallet
 * disconnects mid-switch. Mount once per shell.
 *
 * The toast speaks only for a change the user did NOT make from inside the
 * app: an automatic switch (navigating to a product, a Portfolio card's
 * Supply) or one made from the wallet's own menu. A pick from a product page's
 * network dropdown or the transaction modal's switch is recorded as
 * `pendingManualSwitchChainId` by the shared switch function, and when the
 * wallet lands there the change passes in silence (APP-547).
 */
export function useNetworkChangeToast(intent: Intent) {
  const chainId = useChainId();
  const chains = useChains();
  const { isConnected } = useAccount();
  const {
    isSwitchingNetwork,
    setIsSwitchingNetwork,
    isAutoSwitching,
    setIsAutoSwitching,
    autoSwitchIntent,
    setAutoSwitchIntent,
    pendingManualSwitchChainId,
    setPendingManualSwitchChainId
  } = useNetworkSwitch();
  const { showNetworkToast } = useEnhancedNetworkToast();

  // The module the user navigated away from: the nav click changes the route
  // first, so by the time the chain switch lands the route intent is already
  // the target module. Same-module changes get a short delay before the toast.
  const [intentHistory, setIntentHistory] = useState<{ current: Intent; previous?: Intent }>({
    current: intent
  });
  if (intentHistory.current !== intent) {
    setIntentHistory({ current: intent, previous: intentHistory.current });
  }

  // A chain change is detected in the render that brings it and handed to the
  // effect below as a one-shot event, so the toast fires exactly once per
  // change however often the values it reads move afterwards.
  const [lastChainId, setLastChainId] = useState(chainId);
  const [chainChange, setChainChange] = useState<{ from: number; to: number } | null>(null);
  if (chainId !== lastChainId) {
    setLastChainId(chainId);
    if (chainId && lastChainId) {
      setChainChange({ from: lastChainId, to: chainId });
    }
  }

  // Reset switching state when the wallet disconnects mid-switch. The manual
  // record goes on any disconnect: a pick whose wallet prompt was abandoned
  // never raised `isSwitchingNetwork`, and left in place it would silence the
  // reconnect that happens to land on that chain.
  useEffect(() => {
    if (isConnected) return;
    setPendingManualSwitchChainId(null);
    if (isSwitchingNetwork) {
      setIsSwitchingNetwork(false);
      setIsAutoSwitching(false);
      setAutoSwitchIntent(null);
    }
  }, [
    isConnected,
    isSwitchingNetwork,
    setIsSwitchingNetwork,
    setIsAutoSwitching,
    setAutoSwitchIntent,
    setPendingManualSwitchChainId
  ]);

  // Announce a completed change and settle the switch flags. An effect event:
  // it reads the latest flags and intent without the effect re-running on them.
  const announceChainChange = useEffectEvent(({ from, to }: { from: number; to: number }) => {
    const prevChain = chains.find(c => c.id === from);
    const currChain = chains.find(c => c.id === to);

    if (prevChain && currChain) {
      // Reset switching state when the network change completes
      setIsSwitchingNetwork(false);

      // The wallet landed where an in-app control asked it to: the user's
      // own change, nothing to announce. An auto switch is never manual, and
      // a wallet-side change has no pending request to match.
      const isManualSwitch = !isAutoSwitching && pendingManualSwitchChainId === to;
      if (!isManualSwitch) {
        showNetworkToast({
          previousChain: { id: prevChain.id, name: prevChain.name },
          currentChain: { id: currChain.id, name: currChain.name },
          // An in-place action (e.g. a Portfolio card's Supply) switches the
          // chain without navigating, so the route intent can't explain the
          // change — the recorded reason wins when a flow left one.
          currentIntent: autoSwitchIntent ?? intent,
          previousIntent: intentHistory.previous,
          isAutoSwitch: isAutoSwitching
        });
      }
      setIsAutoSwitching(false);
      setAutoSwitchIntent(null);
    }
    // Any landing spends the request, matched or not — a request left behind
    // would silence the next unrelated change.
    setPendingManualSwitchChainId(null);
  });

  useEffect(() => {
    if (chainChange) {
      announceChainChange(chainChange);
    }
  }, [chainChange]);
}
