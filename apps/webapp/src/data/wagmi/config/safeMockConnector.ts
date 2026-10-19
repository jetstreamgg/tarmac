import { createConnector } from 'wagmi';
import { getAddress } from 'viem';
import type SafeAppsSDK from '@safe-global/safe-apps-sdk';
import type { BaseTransaction, SafeInfo, SendTransactionRequestParams } from '@safe-global/safe-apps-sdk';
import type { SafeAppProvider } from '@safe-global/safe-apps-provider';
import { SAFE_CONNECTOR_ID } from '@/hooks/shared/constants';

/**
 * What the Safe{Wallet} host answers for `txs.getBySafeTxHash`, cut to the fields
 * `SafeAppProvider` reads: the status, the executed hash, and the decoded
 * multiSend that sizes the `wallet_getCallsStatus` receipts.
 */
export type MockSafeTxDetails = {
  safeAddress: string;
  txId: string;
  txStatus: 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  txHash: string | null;
  executedAt: number | null;
  txData: {
    hexData: string;
    to: { value: string };
    value: string;
    operation: number;
    dataDecoded: {
      method: string;
      parameters: { name: string; type: string; value: string; valueDecoded?: unknown[] }[];
    } | null;
  };
};

/**
 * The page-to-host calls, named after the Safe Apps postMessage methods
 * (`getSafeInfo`, `sendTransactions`, `getTxBySafeTxHash`, `rpcCall`).
 */
export type MockSafeHostRequest =
  | { method: 'getSafeInfo' }
  | { method: 'sendTransactions'; params: { txs: BaseTransaction[]; params?: SendTransactionRequestParams } }
  | { method: 'getTxBySafeTxHash'; params: { safeTxHash: string } }
  | { method: 'rpcCall'; params: { call: string; params: unknown[] } };

/** Installed by Playwright (`page.exposeFunction`); its presence is what turns Safe mode on. */
export type MockSafeHost = (request: MockSafeHostRequest) => Promise<unknown>;

// Reproduces the SDK's `eth` input formatters, so the host sees the params a real Safe App sends.
type ParamFormatter = ((arg: unknown) => unknown) | null;
const defaultBlockParam: ParamFormatter = (arg = 'latest') => arg;
const returnFullTxObjectParam: ParamFormatter = (arg = false) => arg;
const blockNumberToHex: ParamFormatter = arg =>
  typeof arg === 'number' && Number.isInteger(arg) ? `0x${arg.toString(16)}` : arg;

const unsupported = (name: string) => async () => {
  throw new Error(`Mock Safe: ${name} is not supported`);
};

/**
 * The `SafeAppsSDK` surface `SafeAppProvider` calls, answered by the host instead
 * of the Safe{Wallet} parent frame. Signing and permissions throw: a flow that
 * needs them fails instead of getting a made-up answer.
 */
export function createMockSafeSdk(host: MockSafeHost): SafeAppsSDK {
  const rpc =
    (call: string, formatters: ParamFormatter[] = []) =>
    async (params?: unknown[]) => {
      const formatted = Array.isArray(params) ? [...params] : [];
      if (Array.isArray(params)) {
        formatters.forEach((formatter, i) => {
          if (formatter) formatted[i] = formatter(formatted[i]);
        });
      }
      return host({ method: 'rpcCall', params: { call, params: formatted } });
    };

  const sdk = {
    txs: {
      send: (params: { txs: BaseTransaction[]; params?: SendTransactionRequestParams }) =>
        host({ method: 'sendTransactions', params }),
      getBySafeTxHash: (safeTxHash: string) => host({ method: 'getTxBySafeTxHash', params: { safeTxHash } }),
      signMessage: unsupported('txs.signMessage'),
      signTypedMessage: unsupported('txs.signTypedMessage')
    },
    eth: {
      call: rpc('eth_call', [null, defaultBlockParam]),
      getBalance: rpc('eth_getBalance', [null, defaultBlockParam]),
      getCode: rpc('eth_getCode', [null, defaultBlockParam]),
      getStorageAt: rpc('eth_getStorageAt', [null, blockNumberToHex, defaultBlockParam]),
      getPastLogs: rpc('eth_getLogs'),
      getBlockByHash: rpc('eth_getBlockByHash', [null, returnFullTxObjectParam]),
      getBlockByNumber: rpc('eth_getBlockByNumber', [blockNumberToHex, returnFullTxObjectParam]),
      getTransactionByHash: rpc('eth_getTransactionByHash'),
      getTransactionReceipt: rpc('eth_getTransactionReceipt'),
      getTransactionCount: rpc('eth_getTransactionCount', [null, defaultBlockParam]),
      getGasPrice: rpc('eth_gasPrice'),
      getEstimateGas: (transaction: unknown) => rpc('eth_estimateGas')([transaction]),
      setSafeSettings: unsupported('eth.setSafeSettings')
    },
    wallet: {
      getPermissions: unsupported('wallet.getPermissions'),
      requestPermissions: unsupported('wallet.requestPermissions')
    }
  };
  return sdk as unknown as SafeAppsSDK;
}

/**
 * The e2e stand-in for wagmi's `safe()` connector: the same id, name and type,
 * no `switchChain` (a Safe exists on one chain), and the real `SafeAppProvider`
 * underneath, so `eth_sendTransaction`, `wallet_sendCalls`, `wallet_getCallsStatus`
 * and capabilities behave exactly as in the Safe{Wallet} iframe. Only the SDK's
 * transport to the parent frame is replaced, by `host`.
 */
export function safeMock({ host }: { host: MockSafeHost }) {
  let provider_: Promise<SafeAppProvider> | undefined;

  return createConnector<SafeAppProvider>(config => ({
    id: SAFE_CONNECTOR_ID,
    name: 'Safe',
    type: 'safe',
    async connect({ withCapabilities } = {}) {
      const accounts = await this.getAccounts();
      const chainId = await this.getChainId();
      return {
        accounts: (withCapabilities
          ? accounts.map(address => ({ address, capabilities: {} }))
          : accounts) as never,
        chainId
      };
    },
    async disconnect() {},
    async getAccounts() {
      const provider = await this.getProvider();
      return ((await provider.request({ method: 'eth_accounts' })) as string[]).map(account =>
        getAddress(account)
      );
    },
    async getProvider() {
      // The promise is cached so overlapping first calls share one provider; a failure is not.
      provider_ ??= (async () => {
        const safe = (await host({ method: 'getSafeInfo' })) as SafeInfo;
        // Unwrapped the way wagmi's `safe()` does it, for Vite's CJS interop.
        const Provider = await import('@safe-global/safe-apps-provider');
        const SafeAppProviderClass =
          typeof Provider.SafeAppProvider !== 'function' &&
          typeof (Provider as unknown as { default: typeof Provider }).default?.SafeAppProvider === 'function'
            ? (Provider as unknown as { default: typeof Provider }).default.SafeAppProvider
            : Provider.SafeAppProvider;
        return new SafeAppProviderClass(safe, createMockSafeSdk(host));
      })().catch(error => {
        provider_ = undefined;
        throw error;
      });
      return provider_;
    },
    async getChainId() {
      const provider = await this.getProvider();
      return Number(provider.chainId);
    },
    async isAuthorized() {
      try {
        return (await this.getAccounts()).length > 0;
      } catch {
        return false;
      }
    },
    // A Safe App reloads to change account or chain, as in wagmi's `safe()`.
    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {
      config.emitter.emit('disconnect');
    }
  }));
}
