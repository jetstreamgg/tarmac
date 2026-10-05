import type { BridgeNetworkId } from '../model/networks';
import type { BridgeRoute } from '../model/types';

const L2_DEPOSIT_MINUTES: Partial<Record<BridgeNetworkId, number>> = {
  optimism: 1,
  unichain: 1,
  base: 3,
  arbitrum: 7
};

/**
 * Mock route resolver (APP-611). Mirrors the agreed routes so every UI state
 * is reachable: Ethereum to L2 native (no claim), L2 to Ethereum CCTP (claim),
 * Avalanche and Solana LayerZero (no claim). The real resolver replaces this.
 */
export function getMockRoute(from: BridgeNetworkId, to: BridgeNetworkId): BridgeRoute {
  if (from === 'avalanche' || from === 'solana' || to === 'avalanche' || to === 'solana') {
    return {
      kind: 'layerzero',
      steps: [
        ...(from === 'solana' ? [] : [{ network: from, action: 'approve' as const }]),
        { network: from, action: 'send' }
      ],
      etaMinutes: 3,
      rate: '1:1',
      bridgeFeeUsd: 0.42,
      slippage: 0,
      requiresClaim: false
    };
  }
  if (from === 'ethereum') {
    return {
      kind: 'native',
      steps: [
        { network: 'ethereum', action: 'approve' },
        { network: 'ethereum', action: 'send' }
      ],
      etaMinutes: L2_DEPOSIT_MINUTES[to] ?? 3,
      rate: '1:1',
      bridgeFeeUsd: 0,
      slippage: 0,
      requiresClaim: false
    };
  }
  return {
    kind: 'cctp',
    steps: [
      { network: from, action: 'approve' },
      { network: from, action: 'send' },
      { network: 'ethereum', action: 'claim' }
    ],
    etaMinutes: 20,
    rate: '1:1',
    bridgeFeeUsd: 0,
    slippage: 0,
    requiresClaim: true
  };
}
