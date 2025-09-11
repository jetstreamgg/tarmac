import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { configDefaults } from 'vitest/config';
import { lingui } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import simpleHtmlPlugin from 'vite-plugin-simple-html';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

enum modeEnum {
  development = 'development',
  production = 'production'
}

// https://vitejs.dev/config/
export default ({ mode }: { mode: modeEnum }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const RPC_PROVIDER_MAINNET = process.env.VITE_RPC_PROVIDER_MAINNET || '';
  const RPC_PROVIDER_SEPOLIA = process.env.VITE_RPC_PROVIDER_SEPOLIA || '';
  const RPC_PROVIDER_TENDERLY = process.env.VITE_RPC_PROVIDER_TENDERLY || '';
  const RPC_PROVIDER_BASE = process.env.VITE_RPC_PROVIDER_BASE || '';
  const RPC_PROVIDER_TENDERLY_BASE = process.env.VITE_RPC_PROVIDER_TENDERLY_BASE || '';
  const RPC_PROVIDER_ARBITRUM = process.env.VITE_RPC_PROVIDER_ARBITRUM || '';
  const RPC_PROVIDER_TENDERLY_ARBITRUM = process.env.VITE_RPC_PROVIDER_TENDERLY_ARBITRUM || '';
  const RPC_PROVIDER_OPTIMISM = process.env.VITE_RPC_PROVIDER_OPTIMISM || '';
  const RPC_PROVIDER_UNICHAIN = process.env.VITE_RPC_PROVIDER_UNICHAIN || '';

  const CONTENT_SECURITY_POLICY = `
    default-src 'self';
    script-src 'self'
      'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
      https://static.cloudflareinsights.com
      https://challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https://explorer-api.walletconnect.com;
    font-src 'self';
    connect-src 'self'
      ${RPC_PROVIDER_MAINNET}
      ${RPC_PROVIDER_TENDERLY}
      ${RPC_PROVIDER_SEPOLIA}
      ${RPC_PROVIDER_BASE}
      ${RPC_PROVIDER_TENDERLY_BASE}
      ${RPC_PROVIDER_ARBITRUM}
      ${RPC_PROVIDER_TENDERLY_ARBITRUM}
      ${RPC_PROVIDER_OPTIMISM}
      ${RPC_PROVIDER_UNICHAIN}
      https://virtual.mainnet.rpc.tenderly.co
      https://virtual.base.rpc.tenderly.co
      https://virtual.arbitrum.rpc.tenderly.co
      https://virtual.optimism.rpc.tenderly.co
      https://virtual.unichain.rpc.tenderly.co
      https://virtual.mainnet.eu.rpc.tenderly.co
      https://virtual.base.eu.rpc.tenderly.co
      https://virtual.arbitrum.eu.rpc.tenderly.co
      https://virtual.optimism.eu.rpc.tenderly.co
      https://virtual.unichain.eu.rpc.tenderly.co
      https://rpc.sepolia.org
      https://mainnet.base.org
      https://safe-transaction-mainnet.safe.global
      https://safe-transaction-base.safe.global
      https://safe-transaction-arbitrum.safe.global
      https://safe-transaction-sepolia.safe.global
      https://safe-transaction-optimism.safe.global
      https://safe-transaction-unichain.safe.global
      https://chain-proxy.wallet.coinbase.com
      https://rpc.porto.sh
      https://vote.makerdao.com
      https://vote.sky.money
      https://query-subgraph-testnet.sky.money
      https://query-subgraph-staging.sky.money
      https://query-subgraph.sky.money
      https://api.thegraph.com
      https://staging-api.sky.money
      https://api.sky.money
      https://api.ipify.org
      https://info-sky.blockanalitica.com
      https://sky-tenderly.blockanalitica.com
      https://api.cow.fi/
      wss://relay.walletconnect.com
      wss://relay.walletconnect.org
      https://pulse.walletconnect.org
      wss://www.walletlink.org
      https://explorer-api.walletconnect.com/
      https://api.web3modal.org
      https://enhanced-provider.rainbow.me
      https://mainnet.unichain.org/
      https://mainnet.optimism.io/
      cloudflareinsights.com;
    frame-src 'self'
      https://verify.walletconnect.com
      https://verify.walletconnect.org
      https://id.porto.sh/
`;

  // Need to remove whitespaces otherwise the app won't build due to unsupported characters
  const parsedCSP = CONTENT_SECURITY_POLICY.replace(/\n/g, '');

  return defineConfig({
    server: {
      // vite default is 5173
      port: 3000,
      cors: {
        origin: [
          // Default option, allows localhost, 127.0.0.1 and ::1
          /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
          'https://app.safe.global'
        ]
      }
    },
    preview: {
      port: 3000
    },
    root: 'src',
    envDir: '../',
    build: {
      outDir: '../dist',
      emptyOutDir: true
    },
    test: {
      exclude: [...configDefaults.exclude],
      globals: true,
      environment: 'happy-dom'
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // If we're in dev mode, alias the packages to their local TypeScript source code for faster HMR
        ...(mode === modeEnum.development
          ? {
              '@jetstreamgg/sky-hooks': path.resolve(__dirname, '../../packages/hooks/src'),
              '@jetstreamgg/sky-utils': path.resolve(__dirname, '../../packages/utils/src'),
              '@jetstreamgg/sky-widgets': path.resolve(__dirname, '../../packages/widgets/src'),
              '@widgets': path.resolve(__dirname, '../../packages/widgets/src')
            }
          : {})
      }
    },
    optimizeDeps: {
      // Optimize safe-apps-provider dependency to get rid of the Safe connector issue
      // and be able to connect Safe apps
      include: ['wagmi > @safe-global/safe-apps-provider']
    },
    plugins: [
      simpleHtmlPlugin({
        minify: true,
        inject: {
          tags: [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content: parsedCSP
              }
            }
          ]
        }
      }),
      nodePolyfills({
        globals: {
          process: false
        },
        include: ['buffer']
      }),
      react({
        plugins: [['@lingui/swc-plugin', {}]]
      }),
      tailwindcss(),
      lingui()
    ]
  });
};
