import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { useChains, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useSafeWalletStatus } from '@/hooks';
import { useIsSafeApp } from '@/hooks/wallet/useIsSafeApp';
import { TransactionReplacedError } from '@/hooks/shared/useTransactionOutcome';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useResetUnfinishedRunOnClose } from '@/modules/ui/hooks/useResetUnfinishedRunOnClose';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { formatBigInt } from '@/utils';
import { CctpConvertReview } from '../components/CctpConvertReview';
import { guardChainId } from '../model/networks';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { isBundleFailure } from '../tracking/sourceRecording';
import { readsBalanceOn } from './balanceQueries';
import { useCctpConvertLegs } from './useCctpConvertLegs';
import { convertStep } from './useDestinationActionLaunch';
import { usePendingScope } from './usePendingScope';

// Where a Confirm's callbacks go once its modal closed.
const DETACHED: TxCallbacks = {
  onMutate: () => undefined,
  onStart: () => undefined,
  onSuccess: () => undefined,
  onError: () => undefined
};

/**
 * Converts the USDC of a CCTP bridge that stopped before its burn back to
 * USDS on its L2 (Figma 90, 94, 96, 97), from its card: the modal reviews the
 * swap's whole USDC and opens on the L2, switching the wallet there first.
 * The legs refuse once any USDC left the wallet since the swap, so USDC held
 * before is never converted. The card goes once its convert is sent and the
 * swap is dropped once it mines; a bundle that reverts brings the card back.
 */
export function useCctpSwapConvertLaunch() {
  const { launch: launchModal, updateModalContent, txCallbacks, isModalOpen, txStatus } = useTransaction();
  const sessionId = useId();
  const queryClient = useQueryClient();
  const chains = useChains();
  const safeStatus = useSafeWalletStatus();
  const isSafeApp = useIsSafeApp();
  // A Safe, or a wallet not known yet not to be one, signs one leg at a time.
  const batch = useShouldUseBatch(safeStatus === 'not-safe');
  const { scope, familyChainId } = usePendingScope();
  const { chainId: walletChainId, address } = useConnection();

  // The card's scope is read where it was clicked: a switch to an L2 fork moves the dev scope.
  const [request, setRequest] = useState<{ swap: UnfinishedCctpSwap; scope: string; chainId: number }>();
  const legCallbacksRef = useRef<TxCallbacks>(txCallbacks);
  // Confirm ran before the convert was prepared: it is sent once it is.
  const confirmPendingRef = useRef(false);
  const legs = useCctpConvertLegs({
    enabled: !!request && walletChainId === request.chainId,
    swap: request?.swap,
    scope: request?.scope,
    amount: request?.swap.usdcAmount,
    chainId: request?.chainId,
    account: address,
    isSafeApp,
    batch,
    getCallbacks: () => legCallbacksRef.current
  });
  const { reset: resetLegs, dropCheck } = legs;
  // A close while the convert still checks the chain must not open the wallet behind the modal.
  useEffect(() => {
    if (!isModalOpen) dropCheck();
  }, [isModalOpen, dropCheck]);
  const steps = useMemo<TransactionStep[]>(
    () =>
      legs.calls.map(call =>
        (call as { functionName?: string }).functionName === 'approve'
          ? { label: t`Approve`, tokenSymbol: 'USDC', failureDetail: stepFailureDetail.approve('USDC') }
          : convertStep()
      ),
    [legs.calls]
  );
  const review = useMemo(
    () =>
      request && (
        <CctpConvertReview
          amount={request.swap.usdcAmount}
          bridged={request.swap.usdcAmount}
          chainId={request.chainId}
          calls={legs.calls}
          isBatch={legs.isBatch}
        />
      ),
    [request, legs.calls, legs.isBatch]
  );
  // The calls are built after the modal opens on the L2; the review prices them.
  useEffect(() => {
    if (!request || !isModalOpen || txStatus !== TxStatus.IDLE || steps.length === 0) return;
    updateModalContent(sessionId, { steps, bundled: legs.isBatch, transactionContent: review });
  }, [request, isModalOpen, txStatus, steps, legs.isBatch, review, sessionId, updateModalContent]);
  // A failed convert is built afresh on the next launch, so a stale simulation error isn't reported again.
  useResetUnfinishedRunOnClose(
    useCallback(() => {
      confirmPendingRef.current = false;
      setRequest(undefined);
    }, [])
  );

  const callbacksRef = useRef(txCallbacks);
  // The Confirm whose callbacks may still reach the modal; none once the modal closes.
  const modalOwnerRef = useRef<TxCallbacks | undefined>(undefined);
  const sendRef = useRef(() => undefined as void);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    if (!isModalOpen) modalOwnerRef.current = undefined;
    sendRef.current = () => {
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
  useEffect(() => sendRef.current(), [legs.ready, legs.error, isModalOpen]);

  const launch = useCallback(
    (swap: UnfinishedCctpSwap) => {
      const chainId = guardChainId({
        network: swap.network,
        familyChainId,
        chainIds: chains.map(chain => chain.id)
      });
      if (!scope || chainId === undefined) return;
      resetLegs();
      confirmPendingRef.current = false;
      setRequest({ swap, scope, chainId });
      const amount = formatBigInt(swap.usdcAmount, { unit: 6, minDecimals: 2, maxDecimals: 2 });
      launchModal({
        // The convert is reviewed first (Figma 94), and its wallet screen keeps the title (Figma 96).
        title: t`Review conversion`,
        transactionTitle: t`Review conversion`,
        confirmLabel: t`Confirm`,
        transactionContent: (
          <CctpConvertReview
            amount={swap.usdcAmount}
            bridged={swap.usdcAmount}
            chainId={chainId}
            calls={[]}
            isBatch={false}
          />
        ),
        transactionScreenContent: (
          <TokenTransferHero
            from={{ symbol: 'USDC', amount }}
            to={{ symbol: 'USDS', amount }}
            testId="bridge-convert-amount"
          />
        ),
        steps: [convertStep()],
        toast: {
          loading: t`Converting ${amount} USDC to USDS`,
          success: t`Funds converted successfully!`,
          error: t`Conversion failed`
        },
        onConfirm: () => {
          const modal = () => (modalOwnerRef.current === callbacks ? callbacksRef.current : DETACHED);
          // The legs link a single convert by its hash; a bundle's calls id is linked before the wallet accepts it.
          let bundle: string | undefined;
          const callbacks: TxCallbacks = {
            onMutate: variables => modal().onMutate(variables),
            onStart: hash => {
              if (!hash) bundle = cctpSwapStore.get(scope, swap.swapTxHash)?.convert;
              modal().onStart(hash);
            },
            onSuccess: (...settled) => {
              cctpSwapStore.clear(scope, swap.swapTxHash);
              void queryClient.invalidateQueries({ predicate: readsBalanceOn(chainId) });
              modal().onSuccess(...settled);
            },
            onError: (error, hash) => {
              const neverLands = isBundleFailure(error) || error instanceof TransactionReplacedError;
              if (neverLands && bundle && cctpSwapStore.get(scope, swap.swapTxHash)?.convert === bundle)
                cctpSwapStore.markConvert(scope, swap.swapTxHash, undefined);
              modal().onError(error, hash);
            }
          };
          legCallbacksRef.current = callbacks;
          modalOwnerRef.current = callbacks;
          confirmPendingRef.current = true;
          sendRef.current();
        },
        sessionId,
        usdValue: Number(formatUnits(swap.usdcAmount, 6)),
        // The convert runs on the swap's L2.
        supportedChainIds: [chainId],
        chainGuardReason: 'launch-chain'
      });
    },
    [launchModal, sessionId, queryClient, chains, familyChainId, scope, resetLegs]
  );

  return { launch };
}
