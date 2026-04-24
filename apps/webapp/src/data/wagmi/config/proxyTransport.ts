import { fallback, http, type Transport } from 'viem';

const PROXY_ORIGIN = import.meta.env.VITE_PROXY_ORIGIN || '';

export function createProxyTransport(chainId: number): Transport {
  return fallback([
    http(`${PROXY_ORIGIN}/rpc/${chainId}`),
    http(`${PROXY_ORIGIN}/rpc-fallback/${chainId}`)
  ]);
}
