import { describe, expect, it } from 'vitest';
import { base, unichain } from 'wagmi/chains';
import { forkChainId } from '@/utils/chainId';
import { TOKENS, getTokenDecimals, getTokensForChain } from './tokens.constants';

describe('TOKENS on the Tenderly fork L2s', () => {
  it('lists the same tokens as the L2 each fork stands in for', () => {
    const symbols = (id: number) => getTokensForChain(id).map(token => [token.symbol, token.address]);
    expect(symbols(forkChainId.base)).toEqual(symbols(base.id));
    expect(symbols(forkChainId.unichain)).toEqual(symbols(unichain.id));
  });

  it('keeps per-chain decimals', () => {
    expect(getTokenDecimals(TOKENS.usdc, forkChainId.base)).toBe(6);
  });
});
