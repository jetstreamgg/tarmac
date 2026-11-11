import { beforeEach, describe, expect, it } from 'vitest';
import {
  createClient,
  custom,
  decodeFunctionData,
  encodeFunctionData,
  isAddressEqual,
  keccak256,
  type Address,
  type Hex
} from 'viem';
import type { ChainReader } from '../types';
import { optimismPortalAbi } from './contracts';
import { opStackWithdrawalMessage } from './opStack';
import { buildOpStackProve } from './opStackProve';
import { BASE_PROVE_GAME_ROOT_CLAIM, BASE_PROVE_TX, BASE_WITHDRAWAL_LOGS } from './withdrawalFixtures';

const MESSAGE = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const GAME: Address = '0x00000000000000000000000000000000000a9e00';
const L2_BLOCK = 30_000_000n;

const real = (() => {
  const prove = decodeFunctionData({ abi: optimismPortalAbi, data: BASE_PROVE_TX.input });
  if (prove.functionName !== 'proveWithdrawalTransaction') throw new Error('Not a prove');
  const [, gameIndex, outputRootProof, withdrawalProof] = prove.args;
  return { gameIndex, outputRootProof, withdrawalProof };
})();

const state = {
  respected: 621,
  gameType: 621,
  rootClaim: BASE_PROVE_GAME_ROOT_CLAIM as Hex,
  stateRoot: real.outputRootProof.stateRoot,
  blocks: [] as unknown[]
};

beforeEach(() => {
  Object.assign(state, {
    respected: 621,
    gameType: 621,
    rootClaim: BASE_PROVE_GAME_ROOT_CLAIM,
    stateRoot: real.outputRootProof.stateRoot,
    blocks: []
  });
});

const l1 = {
  readContract: async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
    switch (functionName) {
      case 'disputeGameFactory':
        return '0x00000000000000000000000000000000000fac70';
      case 'anchorStateRegistry':
        return '0x0000000000000000000000000000000000a5a5a5';
      case 'proofMaturityDelaySeconds':
      case 'disputeGameFinalityDelaySeconds':
        return 1n;
      case 'paused':
        return false;
      case 'respectedGameType':
        return state.respected;
      case 'gameAtIndex':
        return args![0] === real.gameIndex ? [state.gameType, 0n, GAME] : [0, 0n, GAME];
      case 'rootClaim':
        return state.rootClaim;
      case 'rootClaimByChainId':
        return args![0] === 8453n ? state.rootClaim : keccak256('0x03');
      default:
        throw new Error(`unexpected read ${functionName}`);
    }
  }
} as unknown as ChainReader;

/** An L2 node serving the state the real prove was built from. */
const l2 = createClient({
  transport: custom({
    request: async ({ method, params }: { method: string; params: unknown[] }) => {
      if (method === 'eth_getProof') {
        state.blocks.push(params[2]);
        return {
          address: params[0],
          accountProof: [],
          balance: '0x0',
          codeHash: keccak256('0x'),
          nonce: '0x0',
          storageHash: real.outputRootProof.messagePasserStorageRoot,
          storageProof: [{ key: (params[1] as Hex[])[0], value: '0x1', proof: real.withdrawalProof }]
        };
      }
      if (method === 'eth_getBlockByNumber') {
        state.blocks.push(params[0]);
        return {
          hash: real.outputRootProof.latestBlockhash,
          stateRoot: state.stateRoot,
          number: params[0],
          timestamp: '0x1'
        };
      }
      throw new Error(`unexpected ${method}`);
    }
  })
});

const build = (
  routeData: Record<string, string> | undefined = {
    gameIndex: real.gameIndex.toString(),
    l2BlockNumber: L2_BLOCK.toString()
  }
) =>
  buildOpStackProve({
    l1,
    l2,
    network: 'base',
    logs: BASE_WITHDRAWAL_LOGS,
    amount: MESSAGE.amount,
    recipient: MESSAGE.to,
    routeData
  });

describe('buildOpStackProve (golden: the real Base prove)', () => {
  it('builds the real prove calldata from the L2 state at the picked block', async () => {
    const call = await build();
    expect(isAddressEqual(call.address, BASE_PROVE_TX.to)).toBe(true);
    expect(encodeFunctionData(call)).toBe(BASE_PROVE_TX.input);
    expect(state.blocks.every(block => block === `0x${L2_BLOCK.toString(16)}`)).toBe(true);
  });

  it("builds nothing when the L2 state doesn't hash to the game's root", async () => {
    state.stateRoot = keccak256('0x01');
    await expect(build()).rejects.toThrow();
    state.stateRoot = real.outputRootProof.stateRoot;
    state.rootClaim = keccak256('0x02');
    await expect(build()).rejects.toThrow();
  });

  it("checks a super root game's root for this chain", async () => {
    Object.assign(state, { respected: 9, gameType: 9 });
    expect(encodeFunctionData(await build())).toBe(BASE_PROVE_TX.input);
  });

  it('builds nothing for a game of a type the portal no longer accepts', async () => {
    state.gameType = 0;
    await expect(build()).rejects.toThrow();
  });

  it('builds nothing without a picked game, or for a withdrawal that is not the recorded one', async () => {
    await expect(build({})).rejects.toThrow();
    await expect(build({ gameIndex: 'x', l2BlockNumber: '1' })).rejects.toThrow();
    await expect(
      buildOpStackProve({
        l1,
        l2,
        network: 'base',
        logs: BASE_WITHDRAWAL_LOGS,
        amount: MESSAGE.amount + 1n,
        recipient: MESSAGE.to,
        routeData: { gameIndex: '1', l2BlockNumber: '1' }
      })
    ).rejects.toThrow();
  });
});
