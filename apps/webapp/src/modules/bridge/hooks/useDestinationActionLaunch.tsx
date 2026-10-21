import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { useChains, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useIsSafeWallet, useSafeWalletStatus } from '@/hooks';
import { useIsSafeApp } from '@/hooks/wallet/useIsSafeApp';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useResetUnfinishedRunOnClose } from '@/modules/ui/hooks/useResetUnfinishedRunOnClose';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { runMockLegs } from '../adapters/mockAdapter';
import { isOpStackNetwork, type OpStackNetworkId } from '../adapters/nativeDeposit/contracts';
import { guardChainId, type BridgeNetworkId } from '../model/networks';
import { cctpBurnAmount } from '../adapters/cctp/calls';
import {
  canLaunchAction,
  canLaunchConvert,
  canLaunchKeepalive,
  dropSentAction,
  recordAction,
  recordActionSent,
  showsActionButton
} from '../model/pendingTransitions';
import { claimsFromDestinationWallet } from '../model/recipient';
import type { PendingBridge, PendingBridgeNextAction } from '../model/types';
import { formatBigInt } from '@/utils';
import { usdsToNumber } from '../model/usds';
import { pendingBridgeStore } from '../store/pendingStore';
import { withActionRecording } from '../tracking/actionRecording';
import { readsBalanceOn } from './balanceQueries';
import { useArbitrumRedeemLegs } from './useArbitrumRedeemLegs';
import { CCTP_CLAIM_FUNCTION, useCctpClaimLegs } from './useCctpClaimLegs';
import { useCctpConvertLegs } from './useCctpConvertLegs';
import { useOpStackReplayLegs } from './useOpStackReplayLegs';
import { usePendingScope } from './usePendingScope';

/** The action the legs build: a deposit's replay on an OP Stack L2 or redeem or keepalive on Arbitrum, or a CCTP claim or its conversion on Ethereum. */
type Recovery =
  | { kind: 'replay'; network: OpStackNetworkId; routeData?: Record<string, string>; chainId: number }
  | { kind: 'cctp-claim'; routeData?: Record<string, string>; chainId: number }
  | { kind: 'cctp-convert'; amount: bigint; chainId: number }
  | {
      kind: 'redeem';
      action: 'redeem' | 'keepalive';
      routeData?: Record<string, string>;
      chainId: number;
    };

const recoveryOf = (
  bridge: PendingBridge,
  action: PendingBridgeNextAction,
  chainId: number,
  amount: bigint | undefined
): Recovery | undefined => {
  if (action === 'claim' && bridge.routeKind === 'cctp' && bridge.to === 'ethereum')
    return { kind: 'cctp-claim', routeData: bridge.routeData, chainId };
  if (action === 'convert' && amount !== undefined) return { kind: 'cctp-convert', amount, chainId };
  if (bridge.from !== 'ethereum') return undefined;
  if (action === 'replay' && isOpStackNetwork(bridge.to))
    return { kind: 'replay', network: bridge.to, routeData: bridge.routeData, chainId };
  if ((action === 'redeem' || action === 'keepalive') && bridge.to === 'arbitrum')
    return { kind: 'redeem', action, routeData: bridge.routeData, chainId };
  return undefined;
};

/** Why a card's action button is disabled, when the user has to act elsewhere. */
export type DestinationActionHint =
  | { kind: 'safe-executing' }
  | { kind: 'action-sent'; network: BridgeNetworkId }
  | { kind: 'switch-network'; network: BridgeNetworkId; safe: boolean };

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
    case 'keepalive':
      return {
        step: t`Extend`,
        loading: t`Extending the redeem deadline of the deposit of ${amount} USDS`,
        success: t`Deadline extended!`,
        error: t`Extend failed`,
        failure: t`The deadline hasn't been extended.`
      };
    case 'convert':
      return {
        step: t`Convert to USDS`,
        loading: t`Converting ${amount} USDC to USDS`,
        success: t`Converted to USDS!`,
        error: t`Conversion failed`,
        failure: stepFailureDetail.convert('USDC')
      };
  }
};

// Where a card's callbacks go once they no longer own the modal.
const DETACHED: TxCallbacks = {
  onMutate: () => undefined,
  onStart: () => undefined,
  onSuccess: () => undefined,
  onError: () => undefined
};

const isRecipient = (bridge: PendingBridge, account: string | undefined) =>
  !!account && account.toLowerCase() === (bridge.recipient ?? bridge.account).toLowerCase();

/** `action` can be sent now by `account`: the next action, a keepalive of the ticket it redeems, or the recipient's convert. */
const launchable = (bridge: PendingBridge, action: PendingBridgeNextAction, account: string | undefined) =>
  action === 'keepalive'
    ? canLaunchKeepalive(bridge, Date.now())
    : action === 'convert'
      ? canLaunchConvert(bridge) && isRecipient(bridge, account)
      : bridge.nextAction === action &&
        canLaunchAction(bridge) &&
        !claimsFromDestinationWallet(bridge, account);

/** A convert sells what the claim minted at most; the card offers no more than the wallet holds. */
const convertible = (bridge: PendingBridge, amount: bigint | undefined): amount is bigint =>
  amount !== undefined && amount > 0n && amount <= cctpBurnAmount(bridge.amount);

/**
 * The bridge's next destination action (claim, prove or finalize; Figma
 * 3574:64565): the modal opens straight on the "Confirm" wallet screen with
 * the amount hero and a single action. A wallet on another network is switched
 * first, as the modal confirms on open. The replay of an Ethereum to OP Stack
 * deposit and the redeem of an Ethereum to Arbitrum one send their real call
 * once prepared, as does the keepalive that extends that ticket's deadline
 * and the claim of a CCTP transfer to Ethereum (receive, then sell for USDS);
 * the other actions run on the mock executor until the route tickets add
 * their calls. `locked` is true while its
 * session is minimized; `canLaunch` is false when the action can't be sent or
 * its network can't be pinned or switched to, and `actionHint` says why when
 * the user has to act in the wallet (a Safe switches networks in Safe).
 * `launchIn` sends a card stored in another account's list (a CCTP bridge sent
 * to this wallet) and records the action there.
 */
export function useDestinationActionLaunch() {
  const { launch: launchModal, updateModalContent, txCallbacks, isModalOpen, txStatus } = useTransaction();
  const sessionId = useId();
  const queryClient = useQueryClient();
  const chains = useChains();
  const isSafe = useIsSafeWallet();
  const safeStatus = useSafeWalletStatus();
  const isSafeApp = useIsSafeApp();
  // A Safe, or a wallet not known yet not to be one, signs one leg at a time.
  const batch = useShouldUseBatch(safeStatus === 'not-safe');
  const { scope, familyChainId } = usePendingScope();
  const { locked } = useMinimizedSessionLock(sessionId);
  const { chainId: walletChainId, address } = useConnection();
  const { canSwitchChain, handleSwitchChain } = useNetworkSwitch();

  // The deposit whose recovery the legs build, and the card waiting on a network switch to launch.
  const [recovery, setRecovery] = useState<Recovery>();
  const [awaitingSwitch, setAwaitingSwitch] = useState<{
    card: PendingBridge;
    action?: PendingBridgeNextAction;
    /** A convert's USDC. */
    amount?: bigint;
    scope: string;
    chainId: number;
    /** The wallet's network when the switch was asked for. */
    from: number | undefined;
    launchId: number;
  }>();
  const launchedSwitchRef = useRef(awaitingSwitch);
  // Bumped on every launch: only the latest one's switch may open the modal.
  const launchIdRef = useRef(0);
  const legCallbacksRef = useRef<TxCallbacks>(txCallbacks);
  // Confirm ran before the recovery was prepared: it is sent once it is.
  const confirmPendingRef = useRef(false);
  const replay = recovery?.kind === 'replay' ? recovery : undefined;
  const redeem = recovery?.kind === 'redeem' ? recovery : undefined;
  const claim = recovery?.kind === 'cctp-claim' ? recovery : undefined;
  const convert = recovery?.kind === 'cctp-convert' ? recovery : undefined;
  const replayLegs = useOpStackReplayLegs({
    enabled: !!replay && walletChainId === replay.chainId,
    network: replay?.network,
    routeData: replay?.routeData,
    chainId: replay?.chainId,
    getCallbacks: () => legCallbacksRef.current
  });
  const redeemLegs = useArbitrumRedeemLegs({
    action: redeem?.action,
    enabled: !!redeem && walletChainId === redeem.chainId,
    routeData: redeem?.routeData,
    chainId: redeem?.chainId,
    account: address,
    getCallbacks: () => legCallbacksRef.current
  });
  const claimLegs = useCctpClaimLegs({
    enabled: !!claim && walletChainId === claim.chainId,
    routeData: claim?.routeData,
    chainId: claim?.chainId,
    account: address,
    isSafeApp,
    batch,
    getCallbacks: () => legCallbacksRef.current
  });
  const convertLegs = useCctpConvertLegs({
    enabled: !!convert && walletChainId === convert.chainId,
    amount: convert?.amount,
    chainId: convert?.chainId,
    account: address,
    isSafeApp,
    batch,
    getCallbacks: () => legCallbacksRef.current
  });
  const legs = claim ? claimLegs : convert ? convertLegs : redeem ? redeemLegs : replayLegs;
  const resetReplay = replayLegs.reset;
  const resetRedeem = redeemLegs.reset;
  const resetClaim = claimLegs.reset;
  const resetConvert = convertLegs.reset;
  const cctp = claim ?? convert;
  const cctpLegs = claim ? claimLegs : convertLegs;
  // A CCTP claim or convert signs one step per call: the receive, the approve when short and the sale for USDS.
  const cctpSteps = useMemo<TransactionStep[]>(
    () =>
      cctpLegs.calls.map(call => {
        const { functionName } = call as { functionName?: string };
        if (functionName === CCTP_CLAIM_FUNCTION)
          return { label: t`Claim`, tokenSymbol: 'USDC', failureDetail: stepFailureDetail.claim('USDC') };
        if (functionName === 'approve')
          return { label: t`Approve`, tokenSymbol: 'USDC', failureDetail: stepFailureDetail.approve('USDC') };
        return {
          label: t`Convert to USDS`,
          tokenSymbol: 'USDC',
          failureDetail: stepFailureDetail.convert('USDC')
        };
      }),
    [cctpLegs.calls]
  );
  const cctpBundled = cctpLegs.isBatch;
  // The claim's or convert's calls are built after its modal opens.
  useEffect(() => {
    if (!cctp || !isModalOpen || txStatus !== TxStatus.IDLE || cctpSteps.length === 0) return;
    updateModalContent(sessionId, { steps: cctpSteps, bundled: cctpBundled });
  }, [cctp, isModalOpen, txStatus, cctpSteps, cctpBundled, sessionId, updateModalContent]);
  // A failed recovery is built afresh on the next launch, so a stale simulation error isn't reported again.
  useResetUnfinishedRunOnClose(
    useCallback(() => {
      confirmPendingRef.current = false;
      setRecovery(undefined);
    }, [])
  );

  const callbacksRef = useRef(txCallbacks);
  // The account Confirm sends from: a convert is the recipient's only.
  const addressRef = useRef(address);
  // The Confirm whose callbacks may still reach the modal; none once the modal closes.
  const modalOwnerRef = useRef<TxCallbacks | undefined>(undefined);
  const sendReplayRef = useRef(() => undefined as void);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    addressRef.current = address;
    if (!isModalOpen) modalOwnerRef.current = undefined;
    sendReplayRef.current = () => {
      if (!confirmPendingRef.current) return;
      // A closed modal drops the pending Confirm: nothing may reach the wallet behind it.
      if (!isModalOpen) {
        confirmPendingRef.current = false;
        return;
      }
      if (legs.ready) {
        confirmPendingRef.current = false;
        legs.execute();
      } else if (legs.error) {
        confirmPendingRef.current = false;
        legCallbacksRef.current.onError(legs.error, '');
      }
    };
  });
  useEffect(() => sendReplayRef.current(), [legs.ready, legs.error, isModalOpen]);

  const pinChainId = useCallback(
    (bridge: PendingBridge) =>
      guardChainId({ network: bridge.to, familyChainId, chainIds: chains.map(chain => chain.id) }),
    [familyChainId, chains]
  );

  const canLaunch = useCallback(
    (bridge: PendingBridge, action = bridge.nextAction) => {
      const pinned = pinChainId(bridge);
      return (
        !!action &&
        launchable(bridge, action, address) &&
        pinned !== undefined &&
        (walletChainId === pinned || canSwitchChain)
      );
    },
    [pinChainId, walletChainId, canSwitchChain, address]
  );

  const actionHint = useCallback(
    (bridge: PendingBridge, action?: 'convert'): DestinationActionHint | undefined => {
      if (action === 'convert') {
        const sent = bridge.actions.find(done => done.status === 'sent' && done.action === 'convert');
        if (sent) return sent.safe ? { kind: 'safe-executing' } : { kind: 'action-sent', network: bridge.to };
        const pinned = pinChainId(bridge);
        if (canLaunchConvert(bridge) && pinned !== undefined && walletChainId !== pinned && !canSwitchChain)
          return { kind: 'switch-network', network: bridge.to, safe: isSafe };
        return undefined;
      }
      if (!showsActionButton(bridge) || claimsFromDestinationWallet(bridge, address)) return undefined;
      // The keepalive is sent from the redeem's card too.
      const sent = bridge.actions.find(
        done => done.status === 'sent' && (done.action === bridge.nextAction || done.action === 'keepalive')
      );
      if (sent) return sent.safe ? { kind: 'safe-executing' } : { kind: 'action-sent', network: bridge.to };
      const pinned = pinChainId(bridge);
      if (canLaunchAction(bridge) && pinned !== undefined && walletChainId !== pinned && !canSwitchChain)
        return { kind: 'switch-network', network: bridge.to, safe: isSafe };
      return undefined;
    },
    [pinChainId, walletChainId, canSwitchChain, isSafe, address]
  );

  // The card's scope, read where it was clicked: a switch to an L2 fork moves the dev scope.
  const launchIn = useCallback(
    (scope: string, card: PendingBridge, requested?: PendingBridgeNextAction, convertAmount?: bigint) => {
      const launchId = ++launchIdRef.current;
      // The card can predate a broadcast; the store has the sent action.
      const bridge = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === card.id);
      const action = requested ?? bridge?.nextAction;
      if (!bridge || !action || !launchable(bridge, action, address)) return;
      const isConvert = action === 'convert';
      if (isConvert && !convertible(bridge, convertAmount)) return;
      const symbol = isConvert ? 'USDC' : 'USDS';
      const amount = isConvert
        ? formatBigInt(convertAmount!, { unit: 6, minDecimals: 2, maxDecimals: 2 })
        : formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
      const copy = actionCopy(action, amount);
      const pinnedChainId = pinChainId(bridge);
      if (pinnedChainId === undefined) return;
      if (walletChainId !== pinnedChainId) {
        handleSwitchChain({
          chainId: pinnedChainId,
          onSuccess: () =>
            setAwaitingSwitch({
              card,
              action: requested,
              amount: convertAmount,
              scope,
              chainId: pinnedChainId,
              from: walletChainId,
              launchId
            })
        });
        return;
      }
      const nextRecovery = recoveryOf(bridge, action, pinnedChainId, convertAmount);
      if (nextRecovery) {
        resetReplay();
        resetRedeem();
        resetClaim();
        resetConvert();
        confirmPendingRef.current = false;
        setRecovery(nextRecovery);
      }
      launchModal({
        title: t`Confirm`,
        skipReview: true,
        transactionScreenContent: (
          <TransactionAmountHero
            label={t`Amount`}
            amount={amount}
            symbol={symbol}
            dataTestId={isConvert ? 'bridge-convert-amount' : 'bridge-claim-amount'}
          />
        ),
        toast: { loading: copy.loading, success: copy.success, error: copy.error },
        steps: [{ label: copy.step, tokenSymbol: symbol, failureDetail: copy.failure }],
        onConfirm: () => {
          // Retry calls onConfirm again; an action already sent must not go out twice.
          const current = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bridge.id);
          if (!current || !launchable(current, action, addressRef.current)) {
            callbacksRef.current.onError(
              new TransactionRefusedError('This action was already sent.', { final: true })
            );
            return;
          }
          const record =
            (change: (current: PendingBridge, txHash: string) => PendingBridge) => (txHash: string) =>
              pendingBridgeStore.update(scope, bridge.id, current => change(current, txHash));
          // Once another Confirm took over or the modal closed, a late prompt is recorded on the card but leaves the modal alone.
          const callbacks: TxCallbacks = withActionRecording(
            () => (!nextRecovery || modalOwnerRef.current === callbacks ? callbacksRef.current : DETACHED),
            {
              // A Safe reports its Safe tx hash here; the tracker settles it if this flow can't.
              onSent: record((current, txHash) =>
                recordActionSent(current, { action, txHash, at: Date.now(), ...(isSafe && { safe: true }) })
              ),
              onConfirmed: txHash => {
                pendingBridgeStore.update(scope, bridge.id, current =>
                  recordAction(current, { action, txHash, at: Date.now() })
                );
                // A settled bridge leaves the tracker, so its arrival never refreshes these.
                void queryClient.invalidateQueries({ predicate: readsBalanceOn(pinnedChainId) });
              },
              onReverted: record(dropSentAction)
            }
          );
          if (!nextRecovery) {
            void runMockLegs([action], () => callbacks);
            return;
          }
          legCallbacksRef.current = callbacks;
          modalOwnerRef.current = callbacks;
          confirmPendingRef.current = true;
          sendReplayRef.current();
        },
        sessionId,
        usdValue: isConvert ? Number(formatUnits(convertAmount!, 6)) : usdsToNumber(bridge.amount),
        // Destination actions run on the destination network.
        supportedChainIds: [pinnedChainId],
        chainGuardReason: 'launch-chain'
      });
    },
    [
      launchModal,
      sessionId,
      queryClient,
      pinChainId,
      isSafe,
      walletChainId,
      address,
      handleSwitchChain,
      resetReplay,
      resetRedeem,
      resetClaim,
      resetConvert
    ]
  );

  const launch = useCallback(
    (card: PendingBridge, action?: PendingBridgeNextAction, convertAmount?: bigint) => {
      if (scope) launchIn(scope, card, action, convertAmount);
    },
    [launchIn, scope]
  );

  // Launched once the wallet reports the switched network, so the modal's chain guard reads it on open.
  useEffect(() => {
    if (
      !awaitingSwitch ||
      launchedSwitchRef.current === awaitingSwitch ||
      awaitingSwitch.launchId !== launchIdRef.current
    )
      return;
    // The wallet went elsewhere: the switch was abandoned and never opens the modal.
    if (
      walletChainId !== undefined &&
      walletChainId !== awaitingSwitch.chainId &&
      walletChainId !== awaitingSwitch.from
    ) {
      launchedSwitchRef.current = awaitingSwitch;
      return;
    }
    if (walletChainId !== awaitingSwitch.chainId) return;
    launchedSwitchRef.current = awaitingSwitch;
    launchIn(awaitingSwitch.scope, awaitingSwitch.card, awaitingSwitch.action, awaitingSwitch.amount);
  }, [awaitingSwitch, walletChainId, launchIn]);

  return { launch, launchIn, canLaunch, actionHint, locked };
}
