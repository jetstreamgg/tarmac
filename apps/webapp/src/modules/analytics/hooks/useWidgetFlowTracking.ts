import { useRef, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useChains, useConnection } from 'wagmi';
import { useSearchParams } from 'react-router-dom';
import { TxStatus as WidgetTxStatus, type WidgetStateChangeParams } from '@jetstreamgg/sky-widgets';
import { isCowSupportedChainId } from '@jetstreamgg/sky-utils';
import { AppEvents, safeCapture, getViewport, isWithdrawalFlow, reportAnalyticsError } from '../constants';
import { useAnalyticsFlow } from '../context/AnalyticsFlowContext';
import { QueryParams } from '@/lib/constants';

// ── Constants ───────────────────────────────────────────────────────────────

// Maps widget_name → module
const WIDGET_MODULE_MAP: Record<string, string> = {
  savings: 'savings',
  rewards: 'rewards',
  upgrade: 'upgrade',
  expert: 'expert',
  stake: 'stake',
  trade: 'trade',
  seal: 'seal',
  'seal-migration': 'seal-migration'
};

// ── URL param remapping ─────────────────────────────────────────────────────

function remapUrlParams(searchParams: URLSearchParams): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'widget') {
      params[key] = value;
    }
  });

  const widget = searchParams.get('widget');

  // Remap input_amount → amountFrom (trade) or amount (other widgets, negative for withdrawals)
  const rawAmount = params[QueryParams.InputAmount];
  delete params[QueryParams.InputAmount];
  if (rawAmount != null) {
    const num = Number(rawAmount);
    if (!isNaN(num)) {
      if (widget === 'trade') {
        params.amountFrom = num;
      } else {
        const withdrawal = isWithdrawalFlow(
          widget,
          searchParams.get(QueryParams.ExpertModule),
          searchParams.get(QueryParams.Flow),
          searchParams.get(QueryParams.StakeTab),
          searchParams.get(QueryParams.SealTab)
        );
        params.amount = withdrawal ? -Math.abs(num) : num;
      }
    }
  }

  // Remap source_token → tokenSymbolFrom (trade) or assetSymbol (other widgets)
  const sourceToken = params[QueryParams.SourceToken];
  delete params[QueryParams.SourceToken];
  if (sourceToken != null) {
    if (widget === 'trade') {
      params.tokenSymbolFrom = sourceToken;
    } else {
      params.assetSymbol = sourceToken;
    }
  }

  // Remap target_token → tokenSymbolTo (trade only)
  const targetToken = params[QueryParams.TargetToken];
  delete params[QueryParams.TargetToken];
  if (targetToken != null && widget === 'trade') {
    params.tokenSymbolTo = targetToken;
  }

  // Remap reward → productAddress (only for rewards widget)
  const reward = params[QueryParams.Reward];
  delete params[QueryParams.Reward];
  if (reward != null && widget === 'rewards') {
    params.productAddress = reward;
  }

  // Remap expert_module → product (only for expert widget)
  const expertModule = params[QueryParams.ExpertModule];
  delete params[QueryParams.ExpertModule];
  if (expertModule != null && widget === 'expert') {
    const productNameMap: Record<string, string> = { stusds: 'stUSDS' };
    params.product = productNameMap[expertModule as string] ?? expertModule;
  }

  // Remap urn_index → urnIndex (as number)
  const urnIndex = params[QueryParams.UrnIndex];
  delete params[QueryParams.UrnIndex];
  if (urnIndex != null) {
    const num = Number(urnIndex);
    if (!isNaN(num)) {
      params.urnIndex = num;
    }
  }

  // Remap stake_tab → stakeAction (lock→stake, free→unstake)
  const stakeTab = params[QueryParams.StakeTab];
  delete params[QueryParams.StakeTab];
  if (stakeTab != null) {
    const stakeActionMap: Record<string, string> = { lock: 'stake', free: 'unstake' };
    params.stakeAction = stakeActionMap[stakeTab as string] ?? stakeTab;
  }

  return params;
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Self-contained hook that wraps any widget's onWidgetStateChange handler
 * to track transaction start/complete transitions and review screen views.
 *
 * All enrichment (param remapping, module, timestamp, etc.) lives here so that
 * useAppAnalytics stays untouched — when the superset branch lands, this file
 * is simply deleted and replaced by useWidgetAnalytics.
 *
 * Usage in each widget pane:
 * ```
 * const { wrapStateChange } = useWidgetFlowTracking('trade', chainId);
 * <Widget onWidgetStateChange={wrapStateChange(onTradeWidgetStateChange)} />
 * ```
 */
export function useWidgetFlowTracking(widgetName: string, chainId: number) {
  const posthog = usePostHog();
  const { address } = useConnection();
  const chains = useChains();
  const { getFlowId, startNewFlow } = useAnalyticsFlow();
  const [searchParams] = useSearchParams();

  const prevTxStatusRef = useRef<WidgetTxStatus | null>(null);
  const prevScreenRef = useRef<string | null>(null);
  const cowSwapOrderIdRef = useRef<string | null>(null);

  const getChainName = useCallback(
    (id: number) => chains.find(c => c.id === id)?.name ?? `unknown_${id}`,
    [chains]
  );

  const wrapStateChange = useCallback(
    (originalHandler: (params: WidgetStateChangeParams) => void) => {
      return (params: WidgetStateChangeParams) => {
        // Always call the original handler first — analytics must never block functionality
        originalHandler(params);

        try {
          const prev = prevTxStatusRef.current;
          const curr = params.txStatus;
          prevTxStatusRef.current = curr;

          const action = params.widgetState?.action;
          const isCowSwapTrade = widgetName === 'trade' && isCowSupportedChainId(chainId);

          // Capture CowSwap orderId when it arrives (during LOADING, before SUCCESS)
          if (isCowSwapTrade && params.hash) {
            cowSwapOrderIdRef.current = params.hash;
          }

          const txHash = isCowSwapTrade ? undefined : params.hash;
          const orderId = isCowSwapTrade ? params.hash || cowSwapOrderIdRef.current : undefined;

          // Shared enrichment properties
          const enriched = {
            wallet_address: address,
            ...(action && { action }),
            module: WIDGET_MODULE_MAP[widgetName] ?? widgetName,
            ...(widgetName === 'trade' && {
              flow: 'trade',
              swapProvider: isCowSupportedChainId(chainId) ? 'cowswap' : 'psm'
            }),
            timestamp: new Date().toISOString(),
            ...remapUrlParams(searchParams)
          };

          // Transaction started: transition to INITIALIZED
          if (curr === WidgetTxStatus.INITIALIZED && prev !== WidgetTxStatus.INITIALIZED) {
            // Reset orderId for new transactions
            cowSwapOrderIdRef.current = null;

            safeCapture(posthog, AppEvents.TRANSACTION_STARTED, {
              widget_name: widgetName,
              chain_id: chainId,
              chain_name: getChainName(chainId),
              viewport: getViewport(),
              flow_id: getFlowId(),
              ...enriched
            });
          }

          // Transaction completed: transition to SUCCESS
          if (curr === WidgetTxStatus.SUCCESS && prev !== WidgetTxStatus.SUCCESS) {
            safeCapture(posthog, AppEvents.TRANSACTION_COMPLETED, {
              widget_name: widgetName,
              chain_id: chainId,
              chain_name: getChainName(chainId),
              tx_status: 'success',
              ...(txHash && { tx_hash: txHash }),
              ...(orderId && { orderId }),
              viewport: getViewport(),
              flow_id: getFlowId(),
              ...enriched
            });
            startNewFlow();
          }

          // Transaction completed: transition to ERROR
          if (curr === WidgetTxStatus.ERROR && prev !== WidgetTxStatus.ERROR) {
            safeCapture(posthog, AppEvents.TRANSACTION_COMPLETED, {
              widget_name: widgetName,
              chain_id: chainId,
              chain_name: getChainName(chainId),
              tx_status: 'error',
              ...(txHash && { tx_hash: txHash }),
              ...(orderId && { orderId }),
              viewport: getViewport(),
              flow_id: getFlowId(),
              ...enriched
            });
          }

          // Transaction completed: transition to CANCELLED
          if (curr === WidgetTxStatus.CANCELLED && prev !== WidgetTxStatus.CANCELLED) {
            safeCapture(posthog, AppEvents.TRANSACTION_COMPLETED, {
              widget_name: widgetName,
              chain_id: chainId,
              chain_name: getChainName(chainId),
              tx_status: 'cancelled',
              ...(txHash && { tx_hash: txHash }),
              ...(orderId && { orderId }),
              viewport: getViewport(),
              flow_id: getFlowId(),
              ...enriched
            });
          }

          // Review screen viewed: track when user reaches the review/confirmation screen
          const screen = params.widgetState?.screen;
          if (screen !== prevScreenRef.current) {
            prevScreenRef.current = screen;
            if (screen === 'review') {
              safeCapture(posthog, AppEvents.WIDGET_REVIEW_VIEWED, {
                widget_name: widgetName,
                chain_id: chainId,
                chain_name: getChainName(chainId),
                flow: params.widgetState?.flow,
                viewport: getViewport(),
                flow_id: getFlowId(),
                ...enriched
              });
            }
          }
        } catch (error) {
          reportAnalyticsError(`useWidgetFlowTracking:${widgetName}`, error);
        }
      };
    },
    [widgetName, chainId, posthog, address, chains, searchParams, getChainName, getFlowId, startNewFlow]
  );

  return { wrapStateChange };
}
