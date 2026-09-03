import { useEffect, useState } from 'react';
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
  const [previousChainId, setPreviousChainId] = useState<number | undefined>(chainId);

  // The module the user navigated away from: the nav click changes the route
  // first, so by the time the chain switch lands the route intent is already
  // the target module. Same-module changes get a short delay before the toast.
  const [intentHistory, setIntentHistory] = useState<{ current: Intent; previous?: Intent }>({
    current: intent
  });
  useEffect(() => {
    setIntentHistory(prev => (prev.current === intent ? prev : { current: intent, previous: prev.current }));
  }, [intent]);

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

  // Track network changes and show the enhanced toast
  useEffect(() => {
    if (chainId && previousChainId && chainId !== previousChainId) {
      const prevChain = chains.find(c => c.id === previousChainId);
      const currChain = chains.find(c => c.id === chainId);

      if (prevChain && currChain) {
        // Reset switching state when the network change completes
        setIsSwitchingNetwork(false);

        // The wallet landed where an in-app control asked it to: the user's
        // own change, nothing to announce. An auto switch is never manual, and
        // a wallet-side change has no pending request to match.
        const isManualSwitch = !isAutoSwitching && pendingManualSwitchChainId === chainId;
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
    }
    setPreviousChainId(chainId);
  }, [
    chainId,
    previousChainId,
    chains,
    intent,
    intentHistory.previous,
    showNetworkToast,
    setIsSwitchingNetwork,
    isAutoSwitching,
    setIsAutoSwitching,
    autoSwitchIntent,
    setAutoSwitchIntent,
    pendingManualSwitchChainId,
    setPendingManualSwitchChainId
  ]);
}
