import { describe, expect, it } from 'vitest';
import { zeroAddress } from 'viem';
import { ARBITRUM_DEPOSIT, L1_USDS, OP_STACK_DEPOSIT } from '../adapters/nativeDeposit/contracts';
import {
  codeKind,
  codeRisk,
  isBlockedRecipient,
  isSameSafe,
  isValidRecipient,
  recipientProblem,
  recipientRequirement
} from './recipient';

describe('isValidRecipient', () => {
  it('accepts an EVM address and rejects junk on EVM', () => {
    expect(isValidRecipient('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'evm')).toBe(true);
    expect(isValidRecipient('0x123', 'evm')).toBe(false);
  });

  it('accepts a base58 Solana address and rejects an EVM one on Solana', () => {
    expect(isValidRecipient('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana')).toBe(true);
    expect(isValidRecipient('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'solana')).toBe(false);
  });

  it('rejects the zero address, which nobody controls', () => {
    expect(isValidRecipient(zeroAddress, 'evm')).toBe(false);
  });
});

const A = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const B = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const C = '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E';
const safe = (owners: string[], threshold: number) => ({ owners, threshold });

describe('isSameSafe', () => {
  it('matches the same owners in any order and case with the same threshold', () => {
    expect(isSameSafe(safe([A, B], 2), safe([B.toLowerCase(), A], 2))).toBe(true);
  });

  it('rejects a different threshold, an extra owner or a swapped owner', () => {
    expect(isSameSafe(safe([A, B], 2), safe([A, B], 1))).toBe(false);
    expect(isSameSafe(safe([A, B], 2), safe([A, B, C], 2))).toBe(false);
    expect(isSameSafe(safe([A, B], 2), safe([A, C], 2))).toBe(false);
  });
});

const unknownCode = { source: undefined, destination: undefined };
const eoaCode = { source: 'none', destination: undefined } as const;
const deployedCode = { source: 'contract', destination: 'contract' } as const;
const undeployedCode = { source: 'contract', destination: 'none' } as const;

describe('recipientRequirement', () => {
  const evm = { destinationFamily: 'evm' as const, recipient: undefined, code: eoaCode };

  it('a non-EVM destination needs a recipient', () => {
    expect(
      recipientRequirement({
        destinationFamily: 'solana',
        recipient: undefined,
        safe: undefined,
        code: unknownCode
      })
    ).toEqual({
      required: true,
      reason: 'other-family'
    });
  });

  it('an explicit recipient always satisfies it', () => {
    expect(
      recipientRequirement({
        destinationFamily: 'evm',
        recipient: B,
        safe: { source: undefined, destination: null },
        code: unknownCode
      })
    ).toEqual({ required: false });
  });

  it('a Safe typing its own address (any case) is still held to the same-Safe rule', () => {
    expect(
      recipientRequirement({
        destinationFamily: 'evm',
        sender: A,
        recipient: A.toLowerCase(),
        safe: { source: safe([B], 1), destination: null },
        code: deployedCode
      })
    ).toEqual({ required: true, reason: 'safe-not-on-destination' });
  });

  it('an EOA sending to itself on EVM needs nothing', () => {
    expect(recipientRequirement({ ...evm, safe: undefined })).toEqual({ required: false });
  });

  it('a Safe can send to itself only when the same Safe exists on the destination', () => {
    const source = safe([A, B], 2);
    expect(
      recipientRequirement({ ...evm, code: deployedCode, safe: { source, destination: safe([B, A], 2) } })
    ).toEqual({ required: false });
    expect(recipientRequirement({ ...evm, safe: { source, destination: null } })).toEqual({
      required: true,
      reason: 'safe-not-on-destination'
    });
    expect(recipientRequirement({ ...evm, safe: { source, destination: safe([A], 1) } })).toEqual({
      required: true,
      reason: 'safe-differs'
    });
  });

  it('fails closed while either Safe is unknown (loading, error, no Safe service)', () => {
    const unverified = { required: true, reason: 'safe-unverified' };
    expect(recipientRequirement({ ...evm, safe: { source: undefined, destination: safe([A], 1) } })).toEqual(
      unverified
    );
    expect(recipientRequirement({ ...evm, safe: { source: safe([A], 1), destination: undefined } })).toEqual(
      unverified
    );
  });

  it('a contract wallet sending to itself needs code on the destination', () => {
    expect(recipientRequirement({ ...evm, safe: undefined, code: deployedCode })).toEqual({
      required: false
    });
    expect(recipientRequirement({ ...evm, safe: undefined, code: undeployedCode })).toEqual({
      required: true,
      reason: 'contract-not-on-destination'
    });
  });

  it('fails closed while the wallet code is unknown', () => {
    const unverified = { required: true, reason: 'contract-unverified' };
    expect(recipientRequirement({ ...evm, safe: undefined, code: unknownCode })).toEqual(unverified);
    expect(
      recipientRequirement({ ...evm, safe: undefined, code: { source: 'contract', destination: undefined } })
    ).toEqual(unverified);
  });

  it('a same Safe on both networks still needs its code read on the destination', () => {
    const same = { source: safe([A], 1), destination: safe([A], 1) };
    expect(
      recipientRequirement({ ...evm, safe: same, code: { source: 'contract', destination: undefined } })
    ).toEqual({ required: true, reason: 'contract-unverified' });
  });
});

describe('codeKind', () => {
  it('reads no code as none', () => {
    expect(codeKind(undefined)).toBe('none');
    expect(codeKind(null)).toBe('none');
    expect(codeKind('0x')).toBe('none');
  });

  it('reads an EIP-7702 delegation as none: the key still controls the account', () => {
    expect(codeKind(`0xef0100${B.slice(2)}`)).toBe('none');
    expect(codeKind(`0xEF0100${B.slice(2).toUpperCase()}`)).toBe('none');
  });

  it('reads anything else, a longer 0xef0100 prefix included, as a contract', () => {
    expect(codeKind('0x6080604052')).toBe('contract');
    expect(codeKind(`0xef0100${B.slice(2)}00`)).toBe('contract');
  });
});

describe('codeRisk', () => {
  it('passes an EOA without a destination read', () => {
    expect(codeRisk(eoaCode)).toBe('ok');
  });

  it('passes a contract deployed on both networks', () => {
    expect(codeRisk(deployedCode)).toBe('ok');
  });

  it('blocks a contract missing on the destination', () => {
    expect(codeRisk(undeployedCode)).toBe('contract-not-on-destination');
  });

  it('fails closed on any unknown read a verdict depends on', () => {
    expect(codeRisk(unknownCode)).toBe('unverified');
    expect(codeRisk({ source: undefined, destination: 'contract' })).toBe('unverified');
    expect(codeRisk({ source: 'contract', destination: undefined })).toBe('unverified');
  });
});

// Mints to these revert (0x0, the USDS token) or trap the funds; every one was checked on mainnet.
const SYSTEM_RECIPIENTS: [string, string][] = [
  ['zero address', zeroAddress],
  ['burn address', '0x000000000000000000000000000000000000dEaD'],
  ['precompile', '0x0000000000000000000000000000000000000001'],
  ['ArbSys', '0x0000000000000000000000000000000000000064'],
  ['ArbRetryableTx', '0x000000000000000000000000000000000000006E'],
  ['ArbOS', '0x00000000000000000000000000000000000A4B05'],
  ['L2 cross-domain messenger', '0x4200000000000000000000000000000000000007'],
  ['L2 standard bridge', '0x4200000000000000000000000000000000000010'],
  ['last OP predeploy', '0x42000000000000000000000000000000000007fF'],
  ['L1 attributes depositor', '0xDeaDDEaDDeAdDeAdDEAdDEaddeAddEAdDEAd0001'],
  ['Ethereum USDS', L1_USDS],
  ['Arbitrum USDS', ARBITRUM_DEPOSIT.l2Usds],
  ['Sky L1 gateway', ARBITRUM_DEPOSIT.l1Gateway],
  ['Sky L2 gateway', ARBITRUM_DEPOSIT.l2Gateway],
  ['Arbitrum inbox', ARBITRUM_DEPOSIT.inbox],
  ['Arbitrum bridge', ARBITRUM_DEPOSIT.bridge],
  ['L1 gateway router', ARBITRUM_DEPOSIT.l1Router],
  ['L2 gateway router', ARBITRUM_DEPOSIT.l2Router],
  ...Object.entries(OP_STACK_DEPOSIT).flatMap(([network, contracts]) =>
    Object.entries(contracts).map(([name, address]): [string, string] => [`${network} ${name}`, address])
  )
];

describe('isBlockedRecipient', () => {
  it.each(SYSTEM_RECIPIENTS)('blocks the %s', (_, address) => {
    expect(isBlockedRecipient(address)).toBe(true);
    expect(isBlockedRecipient(address.toLowerCase())).toBe(true);
  });

  it('passes ordinary addresses, including ones just outside the system ranges', () => {
    expect(isBlockedRecipient(A)).toBe(false);
    expect(isBlockedRecipient('0x0000000000000000000000000000000100000000')).toBe(false);
    expect(isBlockedRecipient('0x4200000000000000000000000000000000000800')).toBe(false);
  });
});

describe('recipientProblem', () => {
  it('blocks a system address whatever its code', () => {
    expect(recipientProblem(OP_STACK_DEPOSIT.base.l2Usds, deployedCode)).toBe('system-contract');
  });

  it('blocks a contract missing on the destination and fails closed on unknown code', () => {
    expect(recipientProblem(B, undeployedCode)).toBe('contract-not-on-destination');
    expect(recipientProblem(B, unknownCode)).toBe('unverified');
  });

  it('passes an EOA or a contract on both networks', () => {
    expect(recipientProblem(B, eoaCode)).toBeUndefined();
    expect(recipientProblem(B, deployedCode)).toBeUndefined();
  });
});
