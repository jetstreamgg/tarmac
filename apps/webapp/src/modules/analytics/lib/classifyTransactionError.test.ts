import { describe, expect, it } from 'vitest';
import { classifyTransactionError } from './classifyTransactionError';

// Error-like shapes mirroring what viem/wallets actually throw. Wallets nest the
// EIP-1193 4001 at varying depths and don't reliably set err.name, so detection
// must walk the cause chain and fall back to the message.
const rejection4001 = { name: 'UserRejectedRequestError', code: 4001, message: 'User rejected the request.' };

describe('classifyTransactionError', () => {
  it('classifies a wallet rejection nested in the cause chain (MetaMask/Ambire)', () => {
    const err = {
      name: 'ContractFunctionExecutionError',
      message: 'The contract function reverted.',
      cause: { name: 'TransactionExecutionError', cause: rejection4001 }
    };
    // No tx_hash: the rejection happens before broadcast.
    expect(classifyTransactionError(err, false)).toEqual({
      error_kind: 'user_rejected',
      is_user_rejection: true,
      error_code: 4001,
      error_name: 'ContractFunctionExecutionError'
    });
  });

  it('classifies a rejection detected only by message (wallet-specific wrapper, no code/name)', () => {
    const err = { message: 'MetaMask Tx Signature: User denied transaction signature.' };
    const result = classifyTransactionError(err, false);
    expect(result.error_kind).toBe('user_rejected');
    expect(result.is_user_rejection).toBe(true);
    expect(result.error_code).toBeUndefined();
  });

  it('classifies an on-chain revert as reverted (tx broadcast, has hash)', () => {
    const err = {
      name: 'ContractFunctionExecutionError',
      message: 'execution reverted: insufficient balance',
      cause: { name: 'CallExecutionError', code: -32603 }
    };
    expect(classifyTransactionError(err, true)).toEqual({
      error_kind: 'reverted',
      is_user_rejection: false,
      error_code: -32603,
      error_name: 'ContractFunctionExecutionError'
    });
  });

  it('classifies a pre-submission non-rejection failure as wallet_error (no hash, not 4001)', () => {
    const err = { name: 'EstimateGasExecutionError', code: -32000, message: 'insufficient funds for gas' };
    expect(classifyTransactionError(err, false)).toEqual({
      error_kind: 'wallet_error',
      is_user_rejection: false,
      error_code: -32000,
      error_name: 'EstimateGasExecutionError'
    });
  });

  it('falls back to unknown when there is no error object and no hash', () => {
    expect(classifyTransactionError(undefined, false)).toEqual({
      error_kind: 'unknown',
      is_user_rejection: false
    });
  });

  it('omits error_code and error_name rather than emitting undefined values', () => {
    const result = classifyTransactionError({ message: 'plain failure' }, false);
    expect(result).not.toHaveProperty('error_code');
    expect(result).not.toHaveProperty('error_name');
  });

  it('treats a rejection signal with a tx_hash as reverted (broadcast wins over the signal)', () => {
    // A 4001 should never come with a tx_hash, but if it does the tx reached the
    // chain — the hard on-chain fact wins.
    const result = classifyTransactionError(rejection4001, true);
    expect(result.error_kind).toBe('reverted');
    expect(result.is_user_rejection).toBe(false);
  });

  it('does not let a revert reason containing "user denied" flip a broadcast tx to a cancel', () => {
    const err = {
      name: 'CallExecutionError',
      code: -32603,
      message: 'execution reverted: user denied by guardian'
    };
    const result = classifyTransactionError(err, true);
    expect(result.error_kind).toBe('reverted');
    expect(result.is_user_rejection).toBe(false);
  });
});
