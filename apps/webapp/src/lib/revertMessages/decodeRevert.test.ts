import { describe, expect, it } from 'vitest';
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  RawContractError,
  type Abi
} from 'viem';
import { decodeRevert, decodeRevertData } from './decodeRevert';

const errorStringAbi = [
  { type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }
] as const;
const customAbi = [
  { type: 'function', name: 'go', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  {
    type: 'error',
    name: 'InsufficientLiquidity',
    inputs: [{ name: 'needed', type: 'uint256' }]
  }
] as const satisfies Abi;

// The exact revert data from the APP-663 report.
const URN_UNSAFE_DATA = encodeErrorResult({
  abi: errorStringAbi,
  errorName: 'Error',
  args: ['LockstakeEngine/urn-unsafe']
});

describe('decodeRevertData', () => {
  it('decodes Error(string) without an ABI', () => {
    expect(decodeRevertData(URN_UNSAFE_DATA)).toEqual({
      reason: 'LockstakeEngine/urn-unsafe',
      kind: 'error'
    });
  });

  it('decodes Panic(uint256) to its hex code', () => {
    const data = `0x4e487b71${(0x11).toString(16).padStart(64, '0')}` as const;
    expect(decodeRevertData(data)).toEqual({ reason: 'Panic(0x11)', kind: 'panic' });
  });

  it('names a custom error from the ABI, without its arguments', () => {
    const data = encodeErrorResult({ abi: customAbi, errorName: 'InsufficientLiquidity', args: [5n] });
    expect(decodeRevertData(data, customAbi)).toEqual({ reason: 'InsufficientLiquidity', kind: 'custom' });
  });

  it('keeps the selector of a custom error no ABI names', () => {
    const data = encodeErrorResult({ abi: customAbi, errorName: 'InsufficientLiquidity', args: [5n] });
    expect(decodeRevertData(data)).toEqual({ reason: data.slice(0, 10), kind: 'unknown' });
  });

  it('gives nothing for empty revert data', () => {
    expect(decodeRevertData('0x')).toBeUndefined();
  });

  it('caps a very long reason', () => {
    const data = encodeErrorResult({ abi: errorStringAbi, errorName: 'Error', args: ['x'.repeat(500)] });
    expect(decodeRevertData(data)!.reason.length).toBeLessThanOrEqual(161);
  });
});

describe('decodeRevert', () => {
  it('reads viem’s ContractFunctionRevertedError inside a ContractFunctionExecutionError', () => {
    const reverted = new ContractFunctionRevertedError({
      abi: customAbi,
      data: URN_UNSAFE_DATA,
      functionName: 'go'
    });
    const error = new ContractFunctionExecutionError(reverted, { abi: customAbi, functionName: 'go' });
    expect(decodeRevert(error)).toEqual({ reason: 'LockstakeEngine/urn-unsafe', kind: 'error' });
  });

  it('reads raw revert data off an RPC error (the APP-663 response shape)', () => {
    const rpcError = Object.assign(new Error('execution reverted: LockstakeEngine/urn-unsafe'), {
      code: 3,
      data: URN_UNSAFE_DATA
    });
    expect(decodeRevert(new BaseError('Gas estimation failed', { cause: rpcError }))).toEqual({
      reason: 'LockstakeEngine/urn-unsafe',
      kind: 'error'
    });
  });

  it('reads data nested one level down (error.data.data)', () => {
    const walletError = { code: -32603, message: 'Internal error', data: { data: URN_UNSAFE_DATA } };
    expect(decodeRevert({ cause: walletError })?.reason).toBe('LockstakeEngine/urn-unsafe');
  });

  it('reads viem’s RawContractError', () => {
    expect(decodeRevert(new RawContractError({ data: URN_UNSAFE_DATA }))?.reason).toBe(
      'LockstakeEngine/urn-unsafe'
    );
  });

  it('prefers an already-decoded revert carried on the error', () => {
    const error = Object.assign(new Error('Batch simulation: call 1 Vat/dust'), {
      revert: { reason: 'Vat/dust', kind: 'error' as const }
    });
    expect(decodeRevert(error)).toEqual({ reason: 'Vat/dust', kind: 'error' });
  });

  it('falls back to the node’s "execution reverted: <reason>" text', () => {
    expect(
      decodeRevert(new Error('server returned an error response: execution reverted: Vat/not-safe'))
    ).toEqual({ reason: 'Vat/not-safe', kind: 'error' });
    expect(decodeRevert(new Error('Execution reverted with reason: Vat/dust.'))?.reason).toBe('Vat/dust');
  });

  it('does not take viem’s message-filled reason for a revert without data', () => {
    // Alchemy's bare `require`: code 3, data 0x — viem fills `reason` from the message.
    const reverted = new ContractFunctionRevertedError({
      abi: customAbi,
      functionName: 'go',
      message: 'execution reverted'
    });
    expect(decodeRevert(reverted)).toBeUndefined();
    const internal = new ContractFunctionRevertedError({
      abi: customAbi,
      functionName: 'go',
      message: 'Internal JSON-RPC error.'
    });
    expect(decodeRevert(internal)).toBeUndefined();
  });

  it('gives nothing for an empty reason or a reason-less "execution reverted: " line', () => {
    expect(
      decodeRevertData(encodeErrorResult({ abi: errorStringAbi, errorName: 'Error', args: [''] }))
    ).toBeUndefined();
    expect(decodeRevert(new Error('execution reverted: \n\nVersion: viem@2.56.8'))).toBeUndefined();
  });

  it('stops at a batch simulation that failed for a reason other than the calls', () => {
    const structural = Object.assign(new Error('Batch simulation failed'), {
      name: 'BatchSimulationError',
      kind: 'structural',
      cause: new RawContractError({ data: URN_UNSAFE_DATA })
    });
    expect(decodeRevert(structural)).toBeUndefined();
  });

  it('gives nothing for a reasonless revert, a rejection or a network failure', () => {
    expect(decodeRevert(new Error('Execution reverted for an unknown reason.'))).toBeUndefined();
    expect(
      decodeRevert(Object.assign(new Error('User rejected the request.'), { code: 4001 }))
    ).toBeUndefined();
    expect(decodeRevert(new Error('HTTP request failed. Status: 503'))).toBeUndefined();
    expect(decodeRevert(null)).toBeUndefined();
  });
});
