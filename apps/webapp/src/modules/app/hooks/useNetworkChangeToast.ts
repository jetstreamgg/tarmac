import { useEffect, useState } from 'react';
import { useAccount, useChainId, useChains } from 'wagmi';
import { Intent } from '@/lib/enums';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useEnhancedNetworkToast } from './useEnhancedNetworkToast';

/**
 * Shell-level network-change feedback (previously owned by WidgetNavigation):
 * shows the enhanced network toast when the chain changes, and clears the
 * switching/auto-switching flags once the change completes or the wallet
 * disconnects mid-switch. Mount once per shell.
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
    setAutoSwitchIntent
  } = useNetworkSwitch();
  const { showNetworkToast } = useEnhancedNetworkToast();
  const [previousChainId, setPreviousChainId] = useState<number | undefined>(chainId);

  // The module the user navigated away from, for the toast's quick-switch
  // context: the nav click changes the route first, so by the time the chain
  // switch lands the route intent is already the target module.
  const [intentHistory, setIntentHistory] = useState<{ current: Intent; previous?: Intent }>({
    current: intent
  });
  useEffect(() => {
    setIntentHistory(prev => (prev.current === intent ? prev : { current: intent, previous: prev.current }));
  }, [intent]);

  // Reset switching state when the wallet disconnects mid-switch
  useEffect(() => {
    if (!isConnected && isSwitchingNetwork) {
      setIsSwitchingNetwork(false);
      setIsAutoSwitching(false);
      setAutoSwitchIntent(null);
    }
  }, [isConnected, isSwitchingNetwork, setIsSwitchingNetwork, setIsAutoSwitching, setAutoSwitchIntent]);

  // Track network changes and show the enhanced toast
  useEffect(() => {
    if (chainId && previousChainId && chainId !== previousChainId) {
      const prevChain = chains.find(c => c.id === previousChainId);
      const currChain = chains.find(c => c.id === chainId);

      if (prevChain && currChain) {
        // Reset switching state when the network change completes
        setIsSwitchingNetwork(false);

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
        setIsAutoSwitching(false);
        setAutoSwitchIntent(null);
      }
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
    setAutoSwitchIntent
  ]);
}
