import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { Address, Call, PublicClient } from 'viem';
import { toError } from '@/hooks/helpers';
import type { TxMutateVariables } from '@/hooks';
import {
  TransactionRefusedError,
  TransactionReplacedError,
  TransactionRevertedError
} from '@/hooks/shared/useTransactionOutcome';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import { useSendBatchTransactionFlow } from '@/hooks/shared/useSendBatchTransactionFlow';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { createPromptRegistry, PROMPT_OPEN_MESSAGE } from '../store/promptRegistry';
import { usePromptIssuers } from './usePromptIssuers';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Ceiling on the gap between receipt attempts while the RPC keeps failing, as the engine's.
const MAX_RETRY_DELAY_MS = 30_000;

/** The hash a Safe tx executed under, polled like `useWaitForSafeTxHash`: every 2 s up to 150 times (about 5 minutes), while `isWanted`. */
async function safeExecutedHash(chainId: number | undefined, safeTxHash: string, isWanted: () => boolean) {
  const base = chainId === undefined ? undefined : SAFE_TRANSACTION_SERVICE_URL[chainId];
  for (let attempt = 0; base && attempt < 150 && isWanted(); attempt++) {
    try {
      const url = `${base}/api/v1/multisig-transactions/${safeTxHash}/`;
      const data = await (await fetch(url, { signal: AbortSignal.timeout(10_000) })).json();
      if (data.transactionHash) return data.transactionHash as `0x${string}`;
    } catch {
      // Polled again.
    }
    await sleep(2000);
  }
  return undefined;
}

// Bundle windows not answered yet, per lowercase account across mounts: a reopened form must not send while one is open.
const openBundles = createPromptRegistry();

/** Counts a bundle window as open for `account`; the returned release counts it answered, once. */
const openBundle = (account: string | undefined) =>
  account ? openBundles.open(account.toLowerCase()) : () => {};

// Per single-leg wallet prompt, by the request wagmi passes back when it is answered, the release `onLegPrompt` returned.
const legReleases = new WeakMap<object, () => void>();
const answerLeg = (variables: object | undefined) => {
  if (!variables) return;
  legReleases.get(variables)?.();
  legReleases.delete(variables);
};

const SEND_OUT_MESSAGE =
  'A transaction from your last bridge is still open in your wallet or pending. Wait for it to settle before sending again.';
const asRefusal = (error: Error) =>
  error instanceof TransactionRefusedError ? error : new TransactionRefusedError(error.message);

/**
 * The send engine of a bridge's legs on one chain, whatever the route (the source legs or a claim): `calls` go
 * out one at a time, or as one atomic wallet bundle with `batch`. Every send
 * first awaits `preflight`, which refuses it with an error (a closed bridge).
 * A prompt signed after its run ended or after a later Confirm reports to the
 * callbacks `getCallbacks` returned when it opened: a `sendFunctionName` leg (its
 * Confirm's) is recorded and followed to its receipt while those callbacks are current,
 * any other leg is dropped. No send starts while the wallet shows a bundle
 * for the same account, opened from any form, nor while a leg of a reset run
 * is still out. Another account ends the run unless it only awaits its sent leg.
 */
export function useBridgeCallLegs({
  calls,
  chainId,
  client: l1,
  from,
  sendFunctionName,
  preflight,
  isSafeApp,
  batch = false,
  onCallsSent,
  onAccountSwitch,
  onLegSent,
  onLegPrompt,
  onLegFailed,
  getCallbacks
}: {
  /** No calls while the legs can't be built yet. */
  calls: Call[];
  /** The chain the legs are sent on. */
  chainId: number | undefined;
  /** A client on `chainId`, for the preflight and the receipt of a late prompt. */
  client: PublicClient | undefined;
  from: Address | undefined;
  /** The leg that moves the funds, which the source recording keys on. */
  sendFunctionName: string;
  /** Resolves to the reason the send is refused, if any, given the calls this send still has to make. */
  preflight: (client: PublicClient, nextCalls: readonly Call[]) => Promise<Error | undefined>;
  /** Inside the Safe App a signed prompt returns a safeTxHash. */
  isSafeApp?: boolean;
  /** Bundle the legs when the wallet can: the user's batch setting, never for a Safe. */
  batch?: boolean;
  /** The wallet accepted a bundle under this EIP-5792 id, with the context its run was executed with; called right before its `onStart`. */
  onCallsSent?: (id: string, context?: unknown) => void;
  /** The connected account changed. */
  onAccountSwitch?: () => void;
  /** The wallet sent one leg, sequentially, under `hash`, with the context its run was executed with; called for a leg signed after its run ended too. */
  onLegSent?: (hash: string, variables: TxMutateVariables, context?: unknown) => void;
  /** The wallet is about to prompt for one leg, for the run executed with `context`; the release returned runs once it is answered. */
  onLegPrompt?: (variables: TxMutateVariables, context?: unknown) => (() => void) | undefined;
  /** A leg sent one at a time reverted or was replaced, under `hash`; called after its run ended too. */
  onLegFailed?: (hash: string) => void;
  getCallbacks: () => TxCallbacks;
}) {
  // The sender of the run in progress: no other account may sign its later legs.
  const runFromRef = useRef<Address | undefined>(undefined);
  // The run stopped on an error and waits for Retry or a close.
  const pausedRef = useRef(false);
  // The run's send leg is out (queued, from a Safe): no leg is left to sign, only its receipt to wait for.
  const broadcastRef = useRef(false);
  // The callbacks of the Confirm that opened each wallet prompt, so a prompt signed late reports to its own run.
  const issuers = usePromptIssuers(getCallbacks);
  // The request of the last leg prompted one at a time: the run's success belongs to its Confirm.
  const lastPromptRef = useRef<TxMutateVariables | undefined>(undefined);
  // The context `execute` was given, and per wallet prompt the one of the run that opened it.
  const runContextRef = useRef<unknown>(undefined);
  const promptContextsRef = useRef(new WeakMap<object, unknown>());
  // The send name of the Confirm a prompt opened under: a native deposit's follows the form.
  const runSendNameRef = useRef(sendFunctionName);
  const promptSendNamesRef = useRef(new WeakMap<object, string>());
  // Read when a late prompt is signed, whichever render opened it.
  const isSafeAppRef = useRef(isSafeApp);
  useLayoutEffect(() => {
    isSafeAppRef.current = isSafeApp;
  });
  // Unmounted, a late send's receipt is left to its card's tracker.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // The engine waits only for its run's prompts: a late send's receipt reaches its Confirm while the modal follows it.
  const followLate = async (hash: `0x${string}`, issuer: TxCallbacks) => {
    const isFollowed = () => mountedRef.current && issuer === getCallbacks();
    const onChain = isSafeAppRef.current ? await safeExecutedHash(chainId, hash, isFollowed) : hash;
    if (!onChain || !l1) return;
    let sent = onChain;
    let replaced = false;
    // Retried as the engine's receipt query is: one RPC error is not a failure.
    for (let attempt = 0; ; attempt++) {
      try {
        // No timeout, as the engine's wait: a send pending for minutes is not a failure.
        const receipt = await l1.waitForTransactionReceipt({
          hash: sent,
          timeout: 0,
          onReplaced: replacement => {
            if (replacement.reason !== 'repriced') replaced = true;
            else {
              // Its card moves to the new hash even when the modal no longer follows it.
              sent = replacement.transaction.hash;
              issuer.onStart(sent);
            }
          }
        });
        if (!isFollowed()) return;
        if (replaced)
          issuer.onError(
            new TransactionReplacedError(new Error('Transaction replaced in the wallet.')),
            hash
          );
        else if (receipt.status === 'reverted') issuer.onError(new TransactionRevertedError(), sent);
        else issuer.onSuccess(sent, receipt.blockNumber);
        return;
      } catch {
        // Until the modal stops following it: an RPC error never settles a sent leg.
        if (!isFollowed()) return;
        await sleep(Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS));
      }
    }
  };
  // The route a send went out on, held until it settles or resets, as useTransactionFlow holds it.
  const [sendRoute, setSendRoute] = useState<'batch' | 'sequential' | null>(null);
  // The callbacks of the Confirm whose bundle the wallet has not answered yet.
  const bundleIssuerRef = useRef<TxCallbacks | undefined>(undefined);
  // The context of the run whose bundle the wallet has not answered yet.
  const bundleContextRef = useRef<unknown>(undefined);
  // The callbacks of the Confirm whose accepted bundle has not settled yet.
  const acceptedIssuerRef = useRef<TxCallbacks | undefined>(undefined);
  // The releases of the bundle windows open, oldest first.
  const bundlePromptsRef = useRef<(() => void)[]>([]);
  // Set while the engine's execute runs: an error then is its refusal to send, with no window opened.
  const dispatchingRef = useRef(false);
  const walletBatches = batch && calls.length > 1;
  const batchFlow = useSendBatchTransactionFlow({
    calls,
    chainId,
    forceAtomic: true,
    enabled: walletBatches,
    // Not while a send is out: the bundle already signed has nothing left to gate.
    simulateEnabled: walletBatches && sendRoute === null,
    onMutate: () => {
      bundlePromptsRef.current.push(openBundle(runFromRef.current ?? from));
      // An earlier bundle's verdict no longer reaches the modal: recovery reads it from the chain.
      acceptedIssuerRef.current = undefined;
      pausedRef.current = false;
      setSendRoute('batch');
      bundleIssuerRef.current = getCallbacks();
      bundleContextRef.current = runContextRef.current;
      getCallbacks().onMutate(undefined);
    },
    onCallsSent: id => onCallsSent?.(id, bundleContextRef.current),
    onStart: () => {
      bundlePromptsRef.current.shift()?.();
      const issuer = bundleIssuerRef.current ?? getCallbacks();
      bundleIssuerRef.current = undefined;
      bundleContextRef.current = undefined;
      // Set first: its onStart may reset the run, which must keep this bundle's verdict coming.
      acceptedIssuerRef.current = issuer;
      if (issuer === getCallbacks() && runFromRef.current) broadcastRef.current = true;
      // Accepted after its run ended: still recorded under its own Confirm.
      issuer.onStart(undefined);
    },
    onSuccess: (...settled) => {
      const issuer = acceptedIssuerRef.current;
      if (!issuer) return;
      acceptedIssuerRef.current = undefined;
      batchFlow.reset();
      setSendRoute(null);
      // A bundle of an earlier Confirm: recovery resolves its card from the chain.
      if (issuer !== getCallbacks()) return;
      runFromRef.current = undefined;
      issuer.onSuccess(...settled);
    },
    onError: (error, hash) => {
      if (dispatchingRef.current) {
        if (!runFromRef.current) return;
        pausedRef.current = true;
        return getCallbacks().onError(error, undefined);
      }
      const release = bundlePromptsRef.current.shift();
      if (release) {
        release();
        const issuer = bundleIssuerRef.current;
        bundleIssuerRef.current = undefined;
        bundleContextRef.current = undefined;
        setSendRoute(null);
        // A bundle rejected after its run ended, or opened by an earlier Confirm.
        if (!runFromRef.current || (issuer && issuer !== getCallbacks())) return;
        pausedRef.current = true;
        return getCallbacks().onError(error, undefined);
      }
      const issuer = acceptedIssuerRef.current;
      if (!issuer) return;
      acceptedIssuerRef.current = undefined;
      batchFlow.reset();
      setSendRoute(null);
      // Its recording fails the card of a failed bundle, though another Confirm is current.
      issuer.onError(error, hash);
      if (issuer === getCallbacks()) pausedRef.current = true;
    }
  });
  // All legs carry an abi and a function name, so a bundle the RPC can't simulate falls back to one leg at a time.
  const useBatch =
    sendRoute === 'batch'
      ? walletBatches
      : sendRoute === 'sequential'
        ? false
        : walletBatches && !batchFlow.batchUnavailable;
  const sequentialFlow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0 && !useBatch,
    chainId,
    failOnReplaced: true,
    onMutate: variables => {
      pausedRef.current = false;
      setSendRoute('sequential');
      if (variables && runContextRef.current !== undefined)
        promptContextsRef.current.set(variables, runContextRef.current);
      lastPromptRef.current = variables;
      if (variables) {
        promptSendNamesRef.current.set(variables, runSendNameRef.current);
        const release = onLegPrompt?.(variables, runContextRef.current);
        if (release) legReleases.set(variables, release);
      }
      issuers.onMutate(variables);
    },
    onStart: (hash, variables) => {
      answerLeg(variables);
      if (hash && variables) {
        const contexts = promptContextsRef.current;
        if (contexts.has(variables)) onLegSent?.(hash, variables, contexts.get(variables));
        else onLegSent?.(hash, variables);
      }
      const issuer = issuers.issuerOf(variables);
      const current = issuer === getCallbacks();
      const isSend =
        !!variables &&
        variables.functionName === (promptSendNamesRef.current.get(variables) ?? sendFunctionName);
      if (current && runFromRef.current) {
        if (hash && isSend) broadcastRef.current = true;
        return issuer.onStart(hash);
      }
      // Signed after its run ended: the send is recorded under its own Confirm, any other leg is dropped.
      if (variables && !isSend) return;
      issuer.onStart(hash);
      if (hash && variables) void followLate(hash as `0x${string}`, issuer);
    },
    onSuccess: (hash, blockNumber) => {
      setSendRoute(null);
      // A run reset or opened by an earlier Confirm: its sent leg reports its own receipt.
      if (!runFromRef.current || issuers.issuerOf(lastPromptRef.current) !== getCallbacks()) return;
      runFromRef.current = undefined;
      getCallbacks().onSuccess(hash, blockNumber);
    },
    onError: (error, hash, variables) => {
      answerLeg(variables);
      if (hash && (error instanceof TransactionRevertedError || error instanceof TransactionReplacedError))
        onLegFailed?.(hash);
      // A prompt rejected after its run ended, or opened by an earlier Confirm.
      if (!runFromRef.current) return;
      if (variables && issuers.issuerOf(variables) !== getCallbacks()) return;
      pausedRef.current = true;
      getCallbacks().onError(error, hash);
    }
  });

  // The gate polls every minute: read it again before the wallet prompt, so a bridge that just closed costs no gas.
  const checkingRef = useRef(false);
  // Advanced by reset: a switch read that resolves after it sends nothing.
  const runRef = useRef(0);
  const flow = useBatch ? batchFlow : sequentialFlow;
  const { execute: executeFlow } = flow;
  const { reset: resetBatch } = batchFlow;
  // A reset run's sequential leg is still out: the engine holds that run's frozen calls until it settles.
  const { reset: resetSequential, detached: busy, nextCalls } = sequentialFlow;
  const reset = useCallback(
    (onCleared?: () => void) => {
      runRef.current += 1;
      checkingRef.current = false;
      runFromRef.current = undefined;
      pausedRef.current = false;
      broadcastRef.current = false;
      setSendRoute(null);
      // A reset detaches the engine from its send: an accepted bundle, or one the wallet still shows, would never be polled.
      if (!acceptedIssuerRef.current && bundlePromptsRef.current.length === 0) resetBatch();
      resetSequential(onCleared);
    },
    [resetBatch, resetSequential]
  );
  const execute = useCallback(
    // `context` reaches `onLegSent` with every leg this run sends.
    (context?: unknown) => {
      if (checkingRef.current) return;
      if (!l1 || !from)
        return getCallbacks().onError(new TransactionRefusedError('The bridge is not ready to send.'), '');
      // A second send while the wallet still shows a bundle could move the funds twice, under two hashless cards.
      const promptOpen = () => openBundles.isOpen(from.toLowerCase());
      if (promptOpen()) {
        pausedRef.current = true;
        return getCallbacks().onError(new TransactionRefusedError(PROMPT_OPEN_MESSAGE), '');
      }
      // Sent now, the engine would sign the reset run's frozen calls under this Confirm.
      if (busy) {
        pausedRef.current = true;
        return getCallbacks().onError(new TransactionRefusedError(SEND_OUT_MESSAGE), '');
      }
      checkingRef.current = true;
      runContextRef.current = context;
      runSendNameRef.current = sendFunctionName;
      const run = runRef.current;
      // Set before the read: a switch while it is pending drops it.
      runFromRef.current = from;
      pausedRef.current = false;
      broadcastRef.current = false;
      const refuse = (error: Error) => {
        pausedRef.current = true;
        getCallbacks().onError(error, '');
      };
      // A Retry resumes a sequential run after its mined legs; a bundle sends every call again.
      preflight(l1, useBatch ? calls : nextCalls)
        .then(
          refusal => {
            if (run !== runRef.current) return;
            // A preflight refusal is written for the user; a failed read is not.
            if (refusal) return refuse(asRefusal(refusal));
            if (promptOpen()) return refuse(new TransactionRefusedError(PROMPT_OPEN_MESSAGE));
            dispatchingRef.current = true;
            try {
              executeFlow();
            } finally {
              dispatchingRef.current = false;
            }
          },
          error => {
            if (run === runRef.current) refuse(toError(error));
          }
        )
        .finally(() => {
          if (run === runRef.current) checkingRef.current = false;
        });
    },
    [l1, from, busy, preflight, useBatch, calls, nextCalls, executeFlow, getCallbacks, sendFunctionName]
  );

  // A run still in its pre-send check ends with nothing sent: its modal closed.
  const dropCheck = useCallback(() => {
    if (checkingRef.current) reset();
  }, [reset]);

  // Ends the run in progress, if any, with `error` unless it is paused on one already.
  const stop = useCallback(
    (error?: Error) => {
      if (!runFromRef.current) return;
      const paused = pausedRef.current;
      reset();
      if (!paused && error) getCallbacks().onError(error, '');
    },
    [reset, getCallbacks]
  );

  const lastFromRef = useRef(from);
  // Another account, or none, ends the run unless it awaits its sent leg: its later legs would be signed by that account.
  const onAccountChange = useEffectEvent(() => {
    if (from === lastFromRef.current) return;
    lastFromRef.current = from;
    onAccountSwitch?.();
    const runFrom = runFromRef.current;
    if (runFrom && from !== runFrom && (!broadcastRef.current || pausedRef.current))
      stop(new Error('The wallet account changed during the bridge.'));
  });
  useEffect(() => onAccountChange(), [from]);

  return {
    /** The legs go out as one wallet bundle. */
    isBatch: useBatch,
    /** Confirm can send the first leg. */
    ready: calls.length > 0 && flow.prepared,
    /** A leg of a reset run is still out: Confirm must wait for it to settle. */
    busy,
    /** A leg of this run mined and the rest waits for Retry. */
    legMined: !useBatch && sequentialFlow.currentCallIndex > 0,
    /** The first leg's simulation failed. */
    error: calls.length > 0 ? flow.error : null,
    execute,
    reset,
    /** Ends a run whose pre-send check is still out, so it never reaches the wallet. */
    dropCheck,
    stop
  };
}
