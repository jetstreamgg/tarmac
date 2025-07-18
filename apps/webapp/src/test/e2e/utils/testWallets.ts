// Test wallet addresses for parallel workers
// derived from eth_accounts response from tenderly
export const TEST_WALLET_ADDRESSES: `0x${string}`[] = [
  '0xc45806d20044407f33ef0d0885991c738639e5b3',
  '0xb4b115a488fe318d6ecc640bdcf5c2a174c8360a',
  '0xa877a5bb7f56b6ab41810d31e57213955778d3c8',
  '0x83553ca3cbd6a54df133f50bef96b922036e16e1',
  '0xeb20ac98e46b17a2dc2ca1bcc4b8b817a7799c75',
  '0x9ca96a17dc8f9c5c6d8761a452f7974869f8c286',
  '0x30b9f54ba699e3a10c9a733326f73422ba0ed5de',
  '0x96e5ada0e74382196f5b57bc4f012cdcae8949fe',
  '0xbf58ed406fbee2b9c966c47a7da78ff6a291dcc6',
  '0xd42aa67d4a0a7c1b3d390ea899e7b6b9e3715bf1'
] as const;

export const getTestWalletAddress = (workerIndex: number): `0x${string}` => {
  return TEST_WALLET_ADDRESSES[workerIndex];
};
