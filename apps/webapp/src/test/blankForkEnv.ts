import { vi } from 'vitest';

// The mock wallet chain family, the Tenderly fork L2s and fork explorers come from the local .env
// (utils/isTestnetId.ts, data/wagmi/config/forkChains.ts, utils/getEtherscanLink.ts), so tests run
// without them, as CI does. A test that needs them stubs its own.
vi.stubEnv('VITE_USE_MOCK_WALLET', '');
vi.stubEnv('VITE_TENDERLY_RPC_NAME', '');
for (const chain of ['ETHEREUM', 'BASE', 'ARBITRUM', 'OPTIMISM', 'UNICHAIN'])
  vi.stubEnv(`VITE_TENDERLY_EXPLORER_${chain}`, '');
