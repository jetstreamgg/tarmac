import { describe, expect, it } from 'vitest';
import { decodeFunctionData } from 'viem';
import { optimismPortalAbi } from './contracts';
import { outputRoot } from './opStackStatus';
import { BASE_PROVE_GAME_ROOT_CLAIM, BASE_PROVE_TX } from './withdrawalFixtures';

describe('outputRoot (golden: the Base game a real prove used)', () => {
  it("hashes a prove's output root proof into its game's root claim", () => {
    const prove = decodeFunctionData({ abi: optimismPortalAbi, data: BASE_PROVE_TX.input });
    if (prove.functionName !== 'proveWithdrawalTransaction') throw new Error('Not a prove');
    const [, , proof] = prove.args;
    expect(outputRoot(proof)).toBe(BASE_PROVE_GAME_ROOT_CLAIM);
  });
});
