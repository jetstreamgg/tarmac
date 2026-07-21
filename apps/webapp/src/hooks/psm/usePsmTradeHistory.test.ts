import { describe, expect, it } from 'vitest';
import { HISTORY_QUERY_LIMIT, ModuleEnum, TransactionTypeEnum } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { psmTradeFragment, mapPsmTradeRows } from './usePsmTradeHistory';
import { l2SavingsHistoryFragments } from './useL2SavingsHistory';
import { chainId as chainIdMap } from '@/utils';

const WALLET = '0x1111111111111111111111111111111111111111';

describe('psmTradeFragment', () => {
  it('builds a bounded, index-friendly swap query', () => {
    const fragment = psmTradeFragment({ alias: 'swaps', wallet: WALLET, chainId: chainIdMap.base });
    expect(fragment).toContain('swaps: Swap(where: {');
    expect(fragment).toContain(`sender: { _eq: "${WALLET}" }`);
    expect(fragment).toContain(`receiver: { _eq: "${WALLET}" }`);
    expect(fragment).toContain('order_by: { blockTimestamp: desc }');
    expect(fragment).toContain(`limit: ${HISTORY_QUERY_LIMIT}`);
    expect(fragment).not.toContain('_ilike');
    expect(fragment).not.toContain('_neq');
  });

  it('excludes sUSDS with lowercased _neq filters when asked', () => {
    const fragment = psmTradeFragment({
      alias: 'swaps',
      wallet: WALLET,
      chainId: chainIdMap.base,
      excludeSUsds: true
    });
    const sUsds = TOKENS.susds.address[chainIdMap.base].toLowerCase();
    expect(fragment).toContain(`assetIn: { _neq: "${sUsds}" }`);
    expect(fragment).toContain(`assetOut: { _neq: "${sUsds}" }`);
  });

  it('merges the hybrid cutoff and the keyset cursor into ONE blockTimestamp object', () => {
    const fragment = psmTradeFragment({
      alias: 'swaps',
      wallet: WALLET,
      chainId: chainIdMap.base,
      maxBlockTimestamp: 2000,
      beforeTimestamp: 1500
    });
    // A duplicated `blockTimestamp:` input field would be invalid GraphQL.
    expect(fragment.match(/blockTimestamp: \{/g)).toHaveLength(1);
    expect(fragment).toContain('blockTimestamp: { _lte: "2000", _lt: "1500" }');
  });
});

describe('l2SavingsHistoryFragments', () => {
  it('aliases per chain so several chains can share a document', () => {
    const fragment = l2SavingsHistoryFragments({
      wallet: WALLET,
      chainId: chainIdMap.base,
      aliasSuffix: `_${chainIdMap.base}`
    });
    expect(fragment).toContain(`usdsIn_${chainIdMap.base}: Swap`);
    expect(fragment).toContain(`usdsOut_${chainIdMap.base}: Swap`);
    expect(fragment).toContain(`assetIn: { _eq: "${TOKENS.susds.address[chainIdMap.base].toLowerCase()}" }`);
    expect(fragment).toContain(`chainId: { _eq: ${chainIdMap.base} }`);
  });
});

describe('mapPsmTradeRows', () => {
  const tokenAddressMap = {
    [TOKENS.usds.address[chainIdMap.base].toLowerCase()]: TOKENS.usds,
    [TOKENS.susds.address[chainIdMap.base].toLowerCase()]: TOKENS.susds
  };

  it('maps swaps to trade items and skips rows with unmapped tokens', () => {
    const rows = [
      {
        transactionHash: '0xok',
        assetIn: TOKENS.usds.address[chainIdMap.base],
        assetOut: TOKENS.susds.address[chainIdMap.base],
        sender: WALLET,
        amountIn: '1000',
        amountOut: '999',
        blockTimestamp: '1700000000'
      },
      {
        transactionHash: '0xunknown-token',
        assetIn: '0x000000000000000000000000000000000000dead',
        assetOut: TOKENS.susds.address[chainIdMap.base],
        sender: WALLET,
        amountIn: '1',
        amountOut: '1',
        blockTimestamp: '1700000001'
      }
    ];

    const items = mapPsmTradeRows(rows, chainIdMap.base, tokenAddressMap);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      transactionHash: '0xok',
      module: ModuleEnum.TRADE,
      type: TransactionTypeEnum.TRADE,
      fromAmount: 1000n,
      toAmount: 999n,
      chainId: chainIdMap.base
    });
  });
});
