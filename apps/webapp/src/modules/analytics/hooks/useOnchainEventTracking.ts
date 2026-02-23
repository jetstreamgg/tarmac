import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useChains, useConnection } from 'wagmi';
import { useAvailableTokenRewardContracts, type RewardContract } from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';
import { AppEvents, safeCapture, reportAnalyticsError } from '../constants';
import type { OnchainEventData } from '../onchain/types';
import {
  fetchSavingsEvents,
  fetchRewardsEvents,
  fetchStUsdsEvents,
  fetchStakeEvents,
  fetchSealEvents,
  fetchUpgradeEvents,
  fetchPsmTradeEvents,
  fetchCowSwapTradeEvents
} from '../onchain/fetchOnchainEvents';

// ── Poll helper ───────────────────────────────────────────────────────────

const POLL_INTERVAL = 750;
const POLL_TIMEOUT = 30_000;

/**
 * Poll a function until it returns a non-empty array or the timeout expires.
 * Runs independently of React lifecycle — survives component unmounts.
 */
async function pollUntilFound<T>(fn: () => Promise<T[]>): Promise<T[]> {
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result.length > 0) return result;
    } catch {
      // Retry on error
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  return [];
}

// ── Module routing ─────────────────────────────────────────────────────────

async function fetchEventsForModule(
  widgetName: string,
  subgraphUrl: string,
  hash: string,
  chainId: number,
  rewardContracts: RewardContract[],
  metadata?: OnchainTrackingMetadata
): Promise<OnchainEventData[]> {
  switch (widgetName) {
    case 'savings':
      return fetchSavingsEvents(subgraphUrl, hash, chainId);

    case 'rewards': {
      // If a specific reward contract was passed, query only that one.
      // Otherwise query all known contracts (claim-all scenario).
      const contracts =
        metadata?.rewardContract && !isL2ChainId(chainId) ? [metadata.rewardContract] : rewardContracts;
      return fetchRewardsEvents(subgraphUrl, hash, contracts);
    }

    case 'expert':
      return fetchStUsdsEvents(subgraphUrl, hash);

    case 'stake':
      return fetchStakeEvents(subgraphUrl, hash, chainId);

    case 'seal':
      return fetchSealEvents(subgraphUrl, hash, chainId);

    case 'upgrade':
      return fetchUpgradeEvents(subgraphUrl, hash);

    case 'trade':
      // PSM trades go through the subgraph; CowSwap uses its own API
      return fetchPsmTradeEvents(subgraphUrl, hash, chainId);

    default:
      return [];
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface OnchainTrackingMetadata {
  rewardContract?: RewardContract;
  /** Widget flow at the time of the transaction (e.g., 'open', 'manage', 'claim' for stake/seal) */
  flow?: string;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useOnchainEventTracking(chainId: number) {
  const posthog = usePostHog();
  const { address } = useConnection();
  const chains = useChains();
  const subgraphUrl = useSubgraphUrl(chainId);
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const [searchParams] = useSearchParams();

  const getChainName = useCallback(
    (cId: number) => chains.find(c => c.id === cId)?.name ?? `unknown_${cId}`,
    [chains]
  );

  /**
   * Capture onchain events after a transaction completes.
   * Fire-and-forget — never blocks UI, never throws.
   */
  const captureOnchainEvents = useCallback(
    (
      hash: string,
      widgetName: string,
      txStatus: 'success' | 'error',
      metadata?: OnchainTrackingMetadata,
      flowId?: string | null
    ) => {
      // Async IIFE — fire and forget
      (async () => {
        try {
          const commonProps = {
            chain_id: chainId,
            chain_name: getChainName(chainId),
            address,
            tx_id: hash,
            tx_status: txStatus,
            widget: widgetName,
            ...(flowId && { flow_id: flowId }),
            ...(metadata?.flow && { flow: metadata.flow })
          };

          // ── Failed transactions ────────────────────────────────────────
          if (txStatus === 'error') {
            const flow = searchParams.get(QueryParams.Flow);
            const inputAmount = searchParams.get(QueryParams.InputAmount);
            safeCapture(posthog, AppEvents.ONCHAIN_EVENT, {
              ...commonProps,
              event_type: 'unknown',
              date: new Date().toISOString(),
              amount: inputAmount ? Number(inputAmount) : 0,
              token_symbol: 'unknown',
              ...(flow && { attempted_flow: flow })
            });
            return;
          }

          // ── CowSwap detection ──────────────────────────────────────────
          if (widgetName === 'trade' && hash.length > 66) {
            const events = await pollUntilFound(() => fetchCowSwapTradeEvents(hash, chainId));

            if (events.length === 0) {
              reportAnalyticsError(
                'useOnchainEventTracking',
                new Error(`CowSwap order ${hash.slice(0, 20)}… not filled after retries`)
              );
              return;
            }

            for (const evt of events) {
              safeCapture(posthog, AppEvents.ONCHAIN_EVENT, { ...commonProps, ...evt });
            }
            return;
          }

          // ── Subgraph query with retry ──────────────────────────────────
          if (!subgraphUrl) {
            reportAnalyticsError('useOnchainEventTracking', new Error('No subgraph URL'));
            return;
          }

          const events = await pollUntilFound(() =>
            fetchEventsForModule(widgetName, subgraphUrl, hash, chainId, rewardContracts, metadata)
          );

          if (events.length === 0) {
            reportAnalyticsError(
              'useOnchainEventTracking',
              new Error(`No subgraph events found for ${widgetName} tx ${hash} after retries`)
            );
            return;
          }

          for (const evt of events) {
            safeCapture(posthog, AppEvents.ONCHAIN_EVENT, { ...commonProps, ...evt });
          }
        } catch (error) {
          reportAnalyticsError('useOnchainEventTracking', error);
        }
      })();
    },
    [posthog, chainId, address, subgraphUrl, rewardContracts, getChainName, searchParams]
  );

  return { captureOnchainEvents };
}
