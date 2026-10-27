import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { encodeErrorResult } from 'viem';
import { contracts, l2Contracts } from '@/hooks/contracts';
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { panicRevertMessages } from './contracts/panic';
import type { DecodedRevert } from './decodeRevert';
import { contractRevertMessages, revertMessage, revertReport } from '.';

beforeAll(() => {
  i18n.load('en', {});
  i18n.activate('en');
});

const revertData = (reason: string) =>
  encodeErrorResult({
    abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
    errorName: 'Error',
    args: [reason]
  });

const rpcRevert = (reason: string) =>
  Object.assign(new Error('execution reverted'), { data: revertData(reason) });

/** The report for an already-decoded revert (an error carrying it, like BatchSimulationError). */
const report = (revert: DecodedRevert) => revertReport({ revert });
const reportedReason = (revert: DecodedRevert) => report(revert)?.reason;
const isInputRevert = (revert: DecodedRevert) => report(revert)?.isInput;

describe('contractRevertMessages coverage', () => {
  // The guard behind the convention: a contract added to hooks/contracts.ts
  // must get an entry here — its reverts mapped, or `null` on purpose.
  it('has an entry for exactly the contracts in hooks/contracts.ts', () => {
    const names = [...contracts, ...l2Contracts].map(c => c.name).sort();
    expect(
      Object.keys(contractRevertMessages).sort(),
      'contractRevertMessages in lib/revertMessages/index.ts must list every contract, and only those'
    ).toEqual(names);
  });

  it('never maps the same reason in two places', () => {
    const seen = new Map<string, string>();
    const maps = { ...contractRevertMessages, panic: panicRevertMessages };
    for (const [contract, map] of Object.entries(maps)) {
      for (const reason of Object.keys(map ?? {})) {
        expect(seen.get(reason), `${reason} mapped by ${seen.get(reason)} and ${contract}`).toBeUndefined();
        seen.set(reason, contract);
      }
    }
  });
});

describe('revertMessage', () => {
  it('maps the APP-663 urn-unsafe revert to its actionable copy', () => {
    expect(revertMessage(rpcRevert('LockstakeEngine/urn-unsafe'))).toBe(
      'Your position is below the required collateralization ratio. Add collateral or repay debt before changing your delegate.'
    );
  });

  it('maps Vat reverts bubbling up through the engine', () => {
    expect(revertMessage(rpcRevert('Vat/dust'))).toMatch(/minimum borrow amount/);
  });

  it('shows an unmapped reason verbatim', () => {
    expect(revertMessage(rpcRevert('Foo/bar-baz'))).toBe('The transaction would fail with "Foo/bar-baz".');
  });

  it('words an unmapped mined revert in the past tense', () => {
    const error = new TransactionRevertedError({ reason: 'Foo/bar-baz', kind: 'error' });
    expect(revertMessage(error)).toBe('The transaction reverted with "Foo/bar-baz".');
  });

  it('scrubs addresses and long numbers from the reason it reports', () => {
    const reason = `AccessControl: account 0x${'ab'.repeat(20)} is missing role 0x${'00'.repeat(32)}`;
    expect(reportedReason({ reason, kind: 'error' })).toBe('AccessControl: account 0x… is missing role 0x…');
    expect(reportedReason({ reason: '0x1425ea42', kind: 'unknown' })).toBe('0x1425ea42');
    // A selector made of digits stays whole: it identifies the error.
    expect(reportedReason({ reason: '0x12345678', kind: 'unknown' })).toBe('0x12345678');
    expect(reportedReason({ reason: 'Pool/amount-1234567-too-big', kind: 'error' })).toBe(
      'Pool/amount-…-too-big'
    );
    expect(reportedReason({ reason: 'LockstakeEngine/urn-unsafe', kind: 'error' })).toBe(
      'LockstakeEngine/urn-unsafe'
    );
  });

  it('treats a reason named like an Object.prototype key as unmapped', () => {
    expect(revertMessage(rpcRevert('constructor'))).toBe('The transaction would fail with "constructor".');
    expect(revertMessage(rpcRevert('toString'))).toBe('The transaction would fail with "toString".');
  });

  it('gives nothing when there is no revert to explain', () => {
    expect(revertMessage(new TransactionRevertedError())).toBeUndefined();
    expect(revertMessage(new Error('HTTP request failed'))).toBeUndefined();
  });
});

describe('isInputRevert', () => {
  it('silences reverts the typed amount causes', () => {
    expect(isInputRevert({ reason: 'Sky/insufficient-balance', kind: 'error' })).toBe(true);
    expect(isInputRevert({ reason: 'Vat/dust', kind: 'error' })).toBe(true);
  });

  it('knows an OpenZeppelin balance error by name and by bare selector', () => {
    expect(isInputRevert({ reason: 'ERC20InsufficientBalance', kind: 'custom' })).toBe(true);
    expect(isInputRevert({ reason: '0xe450d38c', kind: 'unknown' })).toBe(true);
  });

  it('keeps protocol-state and unknown reverts', () => {
    expect(isInputRevert({ reason: 'LockstakeEngine/urn-unsafe', kind: 'error' })).toBe(false);
    expect(isInputRevert({ reason: 'StUsds/insufficient-unused-funds', kind: 'error' })).toBe(false);
    expect(isInputRevert({ reason: 'Foo/bar-baz', kind: 'error' })).toBe(false);
  });
});

describe('built-in reverts', () => {
  it('gives an overflow panic amount copy instead of its code', () => {
    const panic = Object.assign(new Error('execution reverted'), {
      data: encodeErrorResult({
        abi: [{ type: 'error', name: 'Panic', inputs: [{ name: 'code', type: 'uint256' }] }],
        errorName: 'Panic',
        args: [0x11n]
      })
    });
    expect(revertMessage(panic)).toBe("The contract can't process this amount. Try a smaller amount.");
  });
});
