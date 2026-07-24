import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import type { Call } from 'viem';
import { formatUsd } from '@/utils/formatValue';
import { TRUST_LEVELS } from '../constants';
import type { ReadHook } from '../hooks';
import { usePrices } from '../prices/usePrices';
import { estimateFlowGas } from './estimateFlowGas';
import {
  computeBatchSaving,
  computeFeePerGas,
  computeFeeWei,
  FEE_HISTORY_BLOCK_COUNT,
  feeWeiToUsd,
  getCallsKey,
  PRIORITY_FEE_PERCENTILE
} from './networkFee';
import { useIsBatchSupported } from './useIsBatchSupported';

export type NetworkFeeData = {
  /** Gas for the path the user will actually take — batch when bundling applies. */
  gas: bigint;
  /** Cost of signing the calls one at a time. */
  sequentialGas: bigint;
  /** Cost as a single bundled transaction; undefined when bundling doesn't apply. */
  batchGas?: bigint;
  /** Whether `gas` is the bundled figure. */
  isBatch: boolean;
  feePerGas: bigint;
  feeWei: bigint;
  feeUsd?: number;
  /** Fee as a `$0.00` string, or undefined when we can't price it. */
  formatted?: string;
  /** Proportion of the sequential cost bundling saves (0.184 = 18.4%). */
  batchSaving?: number;
};

export type UseNetworkFeeParameters = {
  /** The same `Call[]` handed to `useTransactionFlow`. */
  calls: Call[];
  chainId?: number;
  /** Mirrors `useTransactionFlow` — bundling is the default when the wallet supports it. */
  shouldUseBatch?: boolean;
  enabled?: boolean;
};

/** Gas units barely move between blocks; the fee-per-gas query carries the freshness. */
const GAS_STALE_TIME = 60_000;

/** Roughly one block, so the displayed fee tracks the base fee without churning. */
const MAINNET_FEE_STALE_TIME = 12_000;
const L2_FEE_STALE_TIME = 30_000;

/**
 * Estimated network fee for a transaction flow, in USD.
 *
 * Returns both the sequential and the bundled cost regardless of which one applies, so
 * the deferred "save X% by bundling" UI can be built on this without rework. The
 * displayed figure follows the path the user is actually on: bundling is on by default
 * (`shouldUseBatch`), so most capable wallets see the batch number — showing the
 * sum-of-calls there would overstate the fee by 12–18%.
 *
 * Never gate a confirm button on this. It's a read-only value, it can legitimately fail
 * (a call that reverts in simulation), and callers should fall back to their `–`
 * placeholder rather than block the flow.
 */
export function useNetworkFee({
  calls,
  chainId,
  shouldUseBatch = true,
  enabled = true
}: UseNetworkFeeParameters): ReadHook & { data?: NetworkFeeData } {
  const connectedChainId = useChainId();
  const resolvedChainId = chainId ?? connectedChainId;
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: resolvedChainId });
  const { data: batchSupported } = useIsBatchSupported();
  const { data: pricesData, isLoading: isPricesLoading } = usePrices();

  // Bundling only exists for multi-call flows on wallets that support it. Wallets that
  // batch some other way (Safe, smart-contract accounts) or sponsor the fee fall through
  // to the sequential estimate — we can't model economics we can't see.
  const wantsBatch = shouldUseBatch && batchSupported === true && calls.length > 1;

  const callsKey = useMemo(() => getCallsKey(calls), [calls]);

  const {
    data: gasData,
    isLoading: isGasLoading,
    error: gasError,
    refetch: refetchGas
  } = useQuery({
    queryKey: ['network-fee-gas', resolvedChainId, address, callsKey, wantsBatch],
    queryFn: () =>
      estimateFlowGas({
        client: publicClient!,
        chainId: resolvedChainId,
        account: address!,
        calls,
        wantsBatch
      }),
    enabled: enabled && !!publicClient && !!address && calls.length > 0,
    staleTime: GAS_STALE_TIME,
    retry: false
  });

  // Priced from fee history rather than `useEstimateFeesPerGas`: that hook prefers
  // `eth_maxPriorityFeePerGas`, which reports the tip needed to be included at all and
  // not the one wallets actually bid. See PRIORITY_FEE_PERCENTILE for the measurement.
  const {
    data: feePerGas,
    isLoading: isFeesLoading,
    error: feesError,
    refetch: refetchFees
  } = useQuery({
    queryKey: ['network-fee-per-gas', resolvedChainId],
    queryFn: async () =>
      computeFeePerGas(
        await publicClient!.getFeeHistory({
          blockCount: FEE_HISTORY_BLOCK_COUNT,
          blockTag: 'latest',
          rewardPercentiles: [PRIORITY_FEE_PERCENTILE]
        })
      ),
    enabled: enabled && !!publicClient,
    staleTime: resolvedChainId === mainnet.id ? MAINNET_FEE_STALE_TIME : L2_FEE_STALE_TIME
  });

  const data = useMemo((): NetworkFeeData | undefined => {
    if (!gasData || feePerGas === undefined) return undefined;

    const isBatch = gasData.batchGas !== undefined;
    const gas = isBatch ? gasData.batchGas! : gasData.sequentialGas;
    const feeWei = computeFeeWei({
      gas,
      feePerGas,
      l1Fee: isBatch ? gasData.batchL1Fee : gasData.sequentialL1Fee
    });
    const ethPrice = pricesData?.ETH?.price;
    const feeUsd = feeWeiToUsd(feeWei, ethPrice === undefined ? undefined : Number(ethPrice));

    return {
      gas,
      sequentialGas: gasData.sequentialGas,
      batchGas: gasData.batchGas,
      isBatch,
      feePerGas,
      feeWei,
      feeUsd,
      formatted: feeUsd === undefined ? undefined : formatUsd(feeUsd),
      batchSaving: computeBatchSaving(gasData.sequentialGas, gasData.batchGas)
    };
  }, [gasData, feePerGas, pricesData]);

  return {
    data,
    isLoading: isGasLoading || isFeesLoading || isPricesLoading,
    error: gasError || feesError,
    mutate: () => {
      refetchGas();
      refetchFees();
    },
    dataSources: [
      {
        title: 'Simulated on-chain execution',
        onChain: true,
        href: 'https://docs.ethereum.org/en/developers/docs/apis/json-rpc/#eth_simulatev1',
        trustLevel: TRUST_LEVELS[0]
      }
    ]
  };
}
