import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useChains, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useIsSafeWallet } from '@/hooks';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useResetPausedRunOnClose } from '@/modules/ui/hooks/useResetPausedRunOnClose';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { runMockLegs } from '../adapters/mockAdapter';
import { isOpStackNetwork, type OpStackNetworkId } from '../adapters/nativeDeposit/contracts';
import { guardChainId, type BridgeNetworkId } from '../model/networks';
import {
  canLaunchAction,
  dropSentAction,
  recordAction,
  recordActionSent,
  showsActionButton
} from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeNextAction } from '../model/types';
import { formatBigInt } from '@/utils';
import { usdsToNumber } from '../model/usds';
import { pendingBridgeStore } from '../store/pendingStore';
import { withActionRecording } from '../tracking/actionRecording';
import { useOpStackReplayLegs } from './useOpStackReplayLegs';
import { usePendingScope } from './usePendingScope';

/** Why a card's action button is disabled, when the user has to act elsewhere. */
export type DestinationActionHint =
  { kind: 'safe-executing' } | { kind: 'switch-network'; network: BridgeNetworkId; safe: boolean };

const actionCopy = (action: PendingBridgeNextAction, amount: string) => {
  switch (action) {
    case 'claim':
      return {
        step: t`Claim`,
        loading: t`Claiming ${amount} USDS`,
        success: t`Funds claimed successfully!`,
        error: t`Claim failed`,
        failure: stepFailureDetail.claim('USDS')
      };
    case 'prove':
      return {
        step: t`Prove`,
        loading: t`Proving the withdrawal of ${amount} USDS`,
        success: t`Withdrawal proven!`,
        error: t`Prove failed`,
        failure: t`The withdrawal hasn't been proven.`
      };
    case 'finalize':
      return {
        step: t`Finalize`,
        loading: t`Finalizing the withdrawal of ${amount} USDS`,
        success: t`Funds received!`,
        error: t`Finalize failed`,
        failure: t`The withdrawal hasn't been finalized.`
      };
    case 'redeem':
      return {
        step: t`Redeem`,
        loading: t`Redeeming the deposit of ${amount} USDS`,
        success: t`Redeem sent!`,
        error: t`Redeem failed`,
        failure: t`The deposit hasn't been redeemed.`
      };
    case 'replay':
      return {
        step: t`Replay`,
        loading: t`Replaying the deposit of ${amount} USDS`,
        success: t`Replay sent!`,
        error: t`Replay failed`,
        failure: t`The deposit hasn't been replayed.`
      };
  }
};

/**
 * The bridge's next destination action (claim, prove or finalize; Figma
 * 3574:64565): the modal opens straight on the "Confirm" wallet screen with
 * the amount hero and a single action. A wallet on another network is switched
 * first, as the modal confirms on open. The replay of an Ethereum to OP Stack
 * deposit sends its real call once prepared; the other actions run on the mock
 * executor until the route tickets add their calls. `locked` is true while its
 * session is minimized; `canLaunch` is false when the action can't be sent or
 * its network can't be pinned or switched to, and `actionHint` says why when
 * the user has to act in the wallet (a Safe switches networks in Safe).
 */
export function useDestinationActionLaunch() {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const sessionId = useId();
  const chains = useChains();
  const isSafe = useIsSafeWallet();
  const { scope, familyChainId } = usePendingScope();
  const { locked } = useMinimizedSessionLock(sessionId);
  const { chainId: walletChainId } = useConnection();
  const { canSwitchChain, handleSwitchChain } = useNetworkSwitch();

  // The deposit whose replay the legs build, and the card waiting on a network switch to launch.
  const [replay, setReplay] = useState<
    { network: OpStackNetworkId; routeData?: Record<string, string>; chainId: number } | undefined
  >();
  const [awaitingSwitch, setAwaitingSwitch] = useState<{
    card: PendingBridge;
    scope: string;
    chainId: number;
  }>();
  const launchedSwitchRef = useRef(awaitingSwitch);
  const legCallbacksRef = useRef<TxCallbacks>(txCallbacks);
  // Confirm ran before the replay was prepared: it is sent once it is.
  const confirmPendingRef = useRef(false);
  const legs = useOpStackReplayLegs({
    enabled: !!replay && walletChainId === replay.chainId,
    network: replay?.network,
    routeData: replay?.routeData,
    chainId: replay?.chainId,
    getCallbacks: () => legCallbacksRef.current
  });
  const resetLegs = legs.reset;
  // A failed replay is built afresh on the next launch, so a stale simulation error isn't reported again.
  useResetPausedRunOnClose(
    useCallback(() => {
      confirmPendingRef.current = false;
      setReplay(undefined);
    }, [])
  );

  const callbacksRef = useRef(txCallbacks);
  const sendReplayRef = useRef(() => undefined as void);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    sendReplayRef.current = () => {
      if (!confirmPendingRef.current) return;
      if (legs.ready) {
        confirmPendingRef.current = false;
        legs.execute();
      } else if (legs.error) {
        confirmPendingRef.current = false;
        legCallbacksRef.current.onError(legs.error, '');
      }
    };
  });
  useEffect(() => sendReplayRef.current(), [legs.ready, legs.error]);

  const pinChainId = useCallback(
    (bridge: PendingBridge) =>
      guardChainId({ network: bridge.to, familyChainId, chainIds: chains.map(chain => chain.id) }),
    [familyChainId, chains]
  );

  const canLaunch = useCallback(
    (bridge: PendingBridge) => {
      const pinned = pinChainId(bridge);
      return canLaunchAction(bridge) && pinned !== undefined && (walletChainId === pinned || canSwitchChain);
    },
    [pinChainId, walletChainId, canSwitchChain]
  );

  const actionHint = useCallback(
    (bridge: PendingBridge): DestinationActionHint | undefined => {
      if (!showsActionButton(bridge)) return undefined;
      if (
        bridge.actions.some(sent => sent.status === 'sent' && sent.safe && sent.action === bridge.nextAction)
      )
        return { kind: 'safe-executing' };
      const pinned = pinChainId(bridge);
      if (canLaunchAction(bridge) && pinned !== undefined && walletChainId !== pinned && !canSwitchChain)
        return { kind: 'switch-network', network: bridge.to, safe: isSafe };
      return undefined;
    },
    [pinChainId, walletChainId, canSwitchChain, isSafe]
  );

  // The card's scope, read where it was clicked: a switch to an L2 fork moves the dev scope.
  const launchIn = useCallback(
    (card: PendingBridge, scope: string) => {
      // The card can predate a broadcast; the store has the sent action.
      const bridge = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === card.id);
      const action = bridge?.nextAction;
      if (!bridge || !action || !canLaunchAction(bridge)) return;
      const amount = formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
      const copy = actionCopy(action, amount);
      const pinnedChainId = pinChainId(bridge);
      if (pinnedChainId === undefined) return;
      if (walletChainId !== pinnedChainId) {
        handleSwitchChain({
          chainId: pinnedChainId,
          onSuccess: () => setAwaitingSwitch({ card, scope, chainId: pinnedChainId })
        });
        return;
      }
      const isReplay = action === 'replay' && bridge.from === 'ethereum' && isOpStackNetwork(bridge.to);
      if (isReplay) {
        resetLegs();
        confirmPendingRef.current = false;
        setReplay({
          network: bridge.to as OpStackNetworkId,
          routeData: bridge.routeData,
          chainId: pinnedChainId
        });
      }
      launchModal({
        title: t`Confirm`,
        skipReview: true,
        transactionScreenContent: (
          <TransactionAmountHero
            label={t`Amount`}
            amount={amount}
            symbol="USDS"
            dataTestId="bridge-claim-amount"
          />
        ),
        toast: { loading: copy.loading, success: copy.success, error: copy.error },
        steps: [{ label: copy.step, tokenSymbol: 'USDS', failureDetail: copy.failure }],
        onConfirm: () => {
          // Retry calls onConfirm again; an action already sent must not go out twice.
          const current = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bridge.id);
          if (!current || current.nextAction !== action || !canLaunchAction(current)) {
            callbacksRef.current.onError(new Error('This action was already sent.'));
            return;
          }
          const record =
            (change: (current: PendingBridge, txHash: string) => PendingBridge) => (txHash: string) =>
              pendingBridgeStore.update(scope, bridge.id, current => change(current, txHash));
          const callbacks = withActionRecording(() => callbacksRef.current, {
            // A Safe reports its Safe tx hash here; the tracker settles it if this flow can't.
            onSent: record((current, txHash) =>
              recordActionSent(current, { action, txHash, at: Date.now(), ...(isSafe && { safe: true }) })
            ),
            onConfirmed: record((current, txHash) =>
              recordAction(current, { action, txHash, at: Date.now() })
            ),
            onReverted: record(dropSentAction)
          });
          if (!isReplay) {
            void runMockLegs([action], () => callbacks);
            return;
          }
          legCallbacksRef.current = callbacks;
          confirmPendingRef.current = true;
          sendReplayRef.current();
        },
        sessionId,
        usdValue: usdsToNumber(bridge.amount),
        // Destination actions run on the destination network.
        supportedChainIds: [pinnedChainId],
        chainGuardReason: 'launch-chain'
      });
    },
    [launchModal, sessionId, pinChainId, isSafe, walletChainId, handleSwitchChain, resetLegs]
  );

  const launch = useCallback(
    (card: PendingBridge) => {
      if (scope) launchIn(card, scope);
    },
    [launchIn, scope]
  );

  // Launched once the wallet reports the switched network, so the modal's chain guard reads it on open.
  useEffect(() => {
    if (!awaitingSwitch || walletChainId !== awaitingSwitch.chainId) return;
    if (launchedSwitchRef.current === awaitingSwitch) return;
    launchedSwitchRef.current = awaitingSwitch;
    launchIn(awaitingSwitch.card, awaitingSwitch.scope);
  }, [awaitingSwitch, walletChainId, launchIn]);

  return { launch, canLaunch, actionHint, locked };
}
