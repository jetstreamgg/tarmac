import type { BridgeRouteKind } from '../model/types';
import { mockAdapter } from './mockAdapter';
import type { BridgeAdapter } from './types';

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: mockAdapter,
  cctp: mockAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
