import { describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import {
  safeMock,
  type MockSafeHost,
  type MockSafeHostRequest,
  type MockSafeTxDetails
} from './safeMockConnector';

const SAFE = getAddress('0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe');
const CHAIN_ID = 314310;
const CHAIN_HEX = '0x4cbc6';
const SAFE_TX_HASH = `0x${'aa'.repeat(32)}`;
const TX_HASH = `0x${'bb'.repeat(32)}`;
const TARGET = getAddress('0x1111111111111111111111111111111111111111');

type Handlers = { [M in MockSafeHostRequest['method']]?: (request: MockSafeHostRequest) => unknown };

function setup(handlers: Handlers = {}) {
  const host = vi.fn<MockSafeHost>(async request => {
    const handler = handlers[request.method];
    if (handler) return handler(request);
    if (request.method === 'getSafeInfo') {
      return { safeAddress: SAFE, chainId: CHAIN_ID, threshold: 1, owners: [], isReadOnly: false };
    }
    throw new Error(`unexpected host call ${request.method}`);
  });
  const emit = vi.fn();
  const connector = safeMock({ host })({ emitter: { emit }, chains: [] } as never);
  const request = async (method: string, params?: unknown[]) =>
    (await connector.getProvider()).request({ method, params } as never);
  return { host, emit, connector, request };
}

function txDetails(overrides: Partial<MockSafeTxDetails>): MockSafeTxDetails {
  return {
    safeAddress: SAFE,
    txId: `multisig_${SAFE}_${SAFE_TX_HASH}`,
    txStatus: 'AWAITING_EXECUTION',
    txHash: null,
    executedAt: null,
    txData: { hexData: '0x', to: { value: TARGET }, value: '0', operation: 0, dataDecoded: null },
    ...overrides
  };
}

const hostCalls = <M extends MockSafeHostRequest['method']>(
  host: ReturnType<typeof setup>['host'],
  method: M
) =>
  host.mock.calls
    .map(([request]) => request)
    .filter((request): request is Extract<MockSafeHostRequest, { method: M }> => request.method === method);

describe('safeMock', () => {
  it('presents as wagmi’s safe connector, with no way to switch chain', () => {
    const { connector } = setup();
    expect(connector).toMatchObject({ id: 'safe', name: 'Safe', type: 'safe' });
    expect(connector.switchChain).toBeUndefined();
  });

  it('asks the host for the Safe once, and only when first used', async () => {
    const { host, connector } = setup();
    expect(host).not.toHaveBeenCalled();

    expect(await connector.getAccounts()).toEqual([SAFE]);
    expect(await connector.getChainId()).toBe(CHAIN_ID);
    await connector.getProvider();
    expect(hostCalls(host, 'getSafeInfo')).toHaveLength(1);
  });

  it('builds one provider when the first calls overlap', async () => {
    const { host, connector } = setup();
    const [first, second] = await Promise.all([connector.getProvider(), connector.getProvider()]);
    expect(first).toBe(second);
    expect(hostCalls(host, 'getSafeInfo')).toHaveLength(1);
  });

  it('asks the host again after a failed first call', async () => {
    const { host, connector } = setup();
    host.mockRejectedValueOnce(new Error('no parent frame'));
    expect(await connector.isAuthorized()).toBe(false);
    expect(await connector.isAuthorized()).toBe(true);
  });

  it('is authorized when the host answers, and not when it fails', async () => {
    expect(await setup().connector.isAuthorized()).toBe(true);

    const failing = setup({
      getSafeInfo: () => {
        throw new Error('no parent frame');
      }
    });
    expect(await failing.connector.isAuthorized()).toBe(false);
  });

  it('connects to the Safe and its chain', async () => {
    const { connector } = setup();
    expect(await connector.connect()).toEqual({ accounts: [SAFE], chainId: CHAIN_ID });
    expect(await connector.connect({ withCapabilities: true })).toEqual({
      accounts: [{ address: SAFE, capabilities: {} }],
      chainId: CHAIN_ID
    });
  });

  it('answers eth_accounts, eth_chainId and capabilities as the Safe iframe does', async () => {
    const { request } = setup();
    expect(await request('eth_accounts')).toEqual([SAFE]);
    expect(await request('eth_chainId')).toBe(CHAIN_HEX);
    expect(await request('wallet_getCapabilities')).toEqual({
      [CHAIN_HEX]: { atomicBatch: { supported: true } }
    });
  });

  it('sends eth_sendTransaction to the host as one tx, with its gas as safeTxGas', async () => {
    const { host, request } = setup({ sendTransactions: () => ({ safeTxHash: SAFE_TX_HASH }) });
    const hash = await request('eth_sendTransaction', [
      { from: SAFE, to: TARGET, data: '0x1234', gas: '0x5208' }
    ]);

    expect(hash).toBe(SAFE_TX_HASH);
    expect(hostCalls(host, 'sendTransactions')).toEqual([
      {
        method: 'sendTransactions',
        params: {
          txs: [{ from: SAFE, to: TARGET, data: '0x1234', value: '0', gas: 21000 }],
          params: { safeTxGas: 21000 }
        }
      }
    ]);
  });

  it('sends wallet_sendCalls to the host as one request for all its calls', async () => {
    const { host, request } = setup({ sendTransactions: () => ({ safeTxHash: SAFE_TX_HASH }) });
    const result = await request('wallet_sendCalls', [
      {
        from: SAFE,
        chainId: CHAIN_HEX,
        calls: [
          { to: TARGET, data: '0xaa' },
          { to: TARGET, data: '0xbb', value: '0x1' }
        ]
      }
    ]);

    expect(result).toEqual({ id: SAFE_TX_HASH });
    expect(hostCalls(host, 'sendTransactions')).toEqual([
      {
        method: 'sendTransactions',
        params: {
          txs: [
            { to: TARGET, data: '0xaa', value: '0x0' },
            { to: TARGET, data: '0xbb', value: '0x1' }
          ]
        }
      }
    ]);
  });

  it('reports a queued batch as pending, without receipts', async () => {
    const { host, request } = setup({ getTxBySafeTxHash: () => txDetails({}) });
    const status = await request('wallet_getCallsStatus', [SAFE_TX_HASH]);

    expect(status).toEqual({ version: '1.0', id: SAFE_TX_HASH, chainId: CHAIN_HEX, status: 100 });
    expect(hostCalls(host, 'getTxBySafeTxHash')).toEqual([
      { method: 'getTxBySafeTxHash', params: { safeTxHash: SAFE_TX_HASH } }
    ]);
    expect(hostCalls(host, 'rpcCall')).toEqual([]);
  });

  it.each([
    ['SUCCESS', 200, '0x1'],
    ['FAILED', 500, '0x0']
  ] as const)(
    'reports an executed %s multiSend with one receipt per call',
    async (txStatus, code, receiptStatus) => {
      const multiSend = {
        method: 'multiSend',
        parameters: [{ name: 'transactions', type: 'bytes', value: '0x', valueDecoded: [{}, {}] }]
      };
      const { host, request } = setup({
        getTxBySafeTxHash: () =>
          txDetails({
            txStatus,
            txHash: TX_HASH,
            txData: { hexData: '0x', to: { value: TARGET }, value: '0', operation: 1, dataDecoded: multiSend }
          }),
        rpcCall: () => ({ blockHash: TX_HASH, blockNumber: '0x10', gasUsed: '0x20', logs: [] })
      });
      const status = (await request('wallet_getCallsStatus', [SAFE_TX_HASH])) as {
        status: number;
        receipts: { status: string; transactionHash: string }[];
      };

      expect(status.status).toBe(code);
      expect(status.receipts).toHaveLength(2);
      expect(status.receipts.every(r => r.status === receiptStatus && r.transactionHash === TX_HASH)).toBe(
        true
      );
      expect(hostCalls(host, 'rpcCall')).toEqual([
        { method: 'rpcCall', params: { call: 'eth_getTransactionReceipt', params: [TX_HASH] } }
      ]);
    }
  );

  it('forwards reads through rpcCall with the params the SDK fills in', async () => {
    const { host, request } = setup({ rpcCall: () => ({ number: '0x5' }) });
    await request('eth_getBalance', [TARGET]);
    await request('eth_call', [{ to: TARGET, data: '0x' }]);
    await request('eth_getBlockByNumber', [5]);
    expect(await request('eth_blockNumber')).toBe('0x5');

    expect(hostCalls(host, 'rpcCall').map(r => r.params)).toEqual([
      { call: 'eth_getBalance', params: [TARGET.toLowerCase(), 'latest'] },
      { call: 'eth_call', params: [{ to: TARGET, data: '0x' }, 'latest'] },
      { call: 'eth_getBlockByNumber', params: ['0x5', false] },
      { call: 'eth_getBlockByNumber', params: ['latest', false] }
    ]);
  });

  it('refuses signing and permissions instead of making up an answer', async () => {
    const { host, request } = setup();
    await expect(request('personal_sign', ['0x68656c6c6f', SAFE])).rejects.toThrow(
      'Mock Safe: txs.signMessage is not supported'
    );
    await expect(request('eth_signTypedData_v4', [SAFE, {}])).rejects.toThrow(
      'Mock Safe: txs.signTypedMessage is not supported'
    );
    await expect(request('wallet_getPermissions')).rejects.toThrow(
      'Mock Safe: wallet.getPermissions is not supported'
    );
    await expect(request('safe_setSettings', [{}])).rejects.toThrow(
      'Mock Safe: eth.setSafeSettings is not supported'
    );
    expect(host.mock.calls.every(([r]) => r.method === 'getSafeInfo')).toBe(true);
  });

  it('emits disconnect when the host disconnects', () => {
    const { connector, emit } = setup();
    connector.onDisconnect();
    expect(emit).toHaveBeenCalledWith('disconnect');
  });
});
