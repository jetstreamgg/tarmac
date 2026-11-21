import type { Query } from '@tanstack/react-query';

const readsWagmiBalanceOn = (queryKey: readonly unknown[], chainId: number) => {
  const [kind, params] = queryKey as [
    unknown,
    { contracts?: { chainId?: number; functionName?: string }[] }?
  ];
  return (
    kind === 'readContracts' &&
    !!params?.contracts?.some(read => read.chainId === chainId && read.functionName === 'balanceOf')
  );
};

// `useTokenBalances` keys its reads by a chain-to-tokens map.
const readsTokenBalancesOn = (queryKey: readonly unknown[], chainId: number) => {
  const [kind, , tokenMap] = queryKey as [unknown, unknown, Record<string, unknown[]>?];
  return kind === 'token-balances' && !!tokenMap?.[chainId]?.length;
};

/** Token balance reads on a chain; a bridge that moved funds there makes them stale. */
export const readsBalanceOn =
  (chainId: number) =>
  ({ queryKey }: Pick<Query, 'queryKey'>): boolean =>
    readsWagmiBalanceOn(queryKey, chainId) || readsTokenBalancesOn(queryKey, chainId);
