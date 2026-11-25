import { describe, expect, it } from 'vitest';
import { createPublicClient, custom, erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { walletSendError } from '@/test/walletSendError';
import { isUnreadWalletSend } from './isUnreadWalletSend';

// Real viem errors: the test fails if a viem upgrade changes how a wallet's answer is wrapped.
describe('isUnreadWalletSend', () => {
  it('is true for a send the wallet answered with an error that has no code', async () => {
    // The MetaMask connector's 60 s limit rejects with this, whatever the wallet did.
    const error = await walletSendError(new Error('Transport request timed out'));
    expect(error.name).toBe('ContractFunctionExecutionError');
    expect(isUnreadWalletSend(error)).toBe(true);
  });

  it('is true for a code viem does not know', async () => {
    const answer = Object.assign(new Error('Something else'), { code: 123456 });
    expect(isUnreadWalletSend(await walletSendError(answer))).toBe(true);
  });

  it.each([
    ['a rejection (4001)', { code: 4001, message: 'User rejected the request.' }],
    ['an unauthorized request (4100)', { code: 4100, message: 'Unauthorized' }],
    ['an internal error (-32603)', { code: -32603, message: 'Internal JSON-RPC error.' }],
    ['a disconnected wallet (4900)', { code: 4900, message: 'Disconnected' }]
  ])('is false for %s', async (_name, answer) => {
    expect(isUnreadWalletSend(await walletSendError(Object.assign(new Error(answer.message), answer)))).toBe(
      false
    );
  });

  it.each([
    ['insufficient funds', new Error('insufficient funds for gas * price + value')],
    ['a revert with no code', new Error('execution reverted: Foo/bar')],
    ['a revert with code 3', Object.assign(new Error('execution reverted'), { code: 3 })],
    ['a nonce too low', new Error('nonce too low')]
  ])('is false for a node refusal viem reads from the answer: %s', async (_name, answer) => {
    expect(isUnreadWalletSend(await walletSendError(answer))).toBe(false);
  });

  it('is false for a failed simulation, which sends nothing', async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: custom(
        {
          request: async () => {
            throw new Error('Transport request timed out');
          }
        },
        { retryCount: 0 }
      )
    });
    const error = await client
      .simulateContract({
        address: '0x0000000000000000000000000000000000000002',
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x0000000000000000000000000000000000000001', 1n],
        account: '0x0000000000000000000000000000000000000001'
      })
      .then(
        () => undefined,
        (failure: Error) => failure
      );
    expect(error?.name).toBe('ContractFunctionExecutionError');
    expect(isUnreadWalletSend(error)).toBe(false);
  });

  it('is false for errors that are not a wallet send', () => {
    expect(isUnreadWalletSend(new Error('Transport request timed out'))).toBe(false);
    expect(isUnreadWalletSend(new TransactionRevertedError())).toBe(false);
    expect(isUnreadWalletSend(undefined)).toBe(false);
    expect(isUnreadWalletSend('Transport request timed out')).toBe(false);
  });
});
