// Vite sets MODE to production when running vite build
// https://vitejs.dev/guide/env-and-mode#modes
// The dev wagmi config, with the Tenderly forks beside the production chains, runs under vite dev and testnet builds.
// Lingui-free, so the engine layer (forkChains) and the app (lib/constants re-exports it) share this one rule.
export const USE_TESTNET_CONFIG =
  import.meta.env?.VITE_TESTNET_CONFIG === 'true' || import.meta.env?.MODE === 'development';
