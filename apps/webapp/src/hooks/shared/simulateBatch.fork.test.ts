/**
 * The batch validator against a real Tenderly fork: the same `eth_call` + code override
 * the app issues, with balances injected through the admin RPC. `eth_call` sees the
 * vnet's own mutated state (unlike `eth_simulateV1`, which does not — see the network
 * fee estimator's notes), so a genuine approve→swap validates here and a deliberately
 * broken bundle is refused with the sub-call's real reason.
 */
import { describe, expect, it } from 'vitest';
import { getPublicClient } from '@wagmi/core';
import { erc20Abi, parseEther, type Call } from 'viem';
import { config, TEST_WALLET_ADDRESS } from '../../../test/hooks';
import { setErc20Balance } from '../../../test/hooks/utils';
import { TENDERLY_CHAIN_ID } from '../constants';
import { daiUsdsAbi, daiUsdsAddress, mcdDaiAddress } from '../generated';
import { BatchSimulationError, simulateBatch } from './simulateBatch';

const DAI = mcdDaiAddress[TENDERLY_CHAIN_ID];
const DAI_USDS = daiUsdsAddress[TENDERLY_CHAIN_ID];
const amount = parseEther('10');

const approve: Call = {
  to: DAI,
  abi: erc20Abi,
  functionName: 'approve',
  args: [DAI_USDS, amount]
} as unknown as Call;
const swap: Call = {
  to: DAI_USDS,
  abi: daiUsdsAbi,
  functionName: 'daiToUsds',
  args: [TEST_WALLET_ADDRESS, amount]
} as unknown as Call;

const client = () => getPublicClient(config, { chainId: TENDERLY_CHAIN_ID })!;

describe('simulateBatch on the fork', () => {
  it('validates a dependent approve → swap in one atomic call', async () => {
    await setErc20Balance(DAI, '100');

    await expect(
      simulateBatch({
        client: client(),
        chainId: TENDERLY_CHAIN_ID,
        account: TEST_WALLET_ADDRESS,
        calls: [approve, swap]
      })
    ).resolves.toHaveLength(2);
  });

  it('refuses the swap without its approve, naming the inner reason', async () => {
    await setErc20Balance(DAI, '100');

    const failure = await simulateBatch({
      client: client(),
      chainId: TENDERLY_CHAIN_ID,
      account: TEST_WALLET_ADDRESS,
      calls: [swap]
    }).catch(error => error);

    expect(failure).toBeInstanceOf(BatchSimulationError);
    expect(failure.kind).toBe('reverted');
    expect(failure.callIndex).toBe(0);
    expect(failure.message).toContain('Dai/insufficient-allowance');
  });

  it('refuses a bundle whose target has no code on this chain', async () => {
    // The shape of a cross-chain address-map miss: `approve` on an empty address
    // "succeeds" and returns nothing.
    const codeless: Call = { ...approve, to: '0x2222222222222222222222222222222222222222' } as Call;

    const failure = await simulateBatch({
      client: client(),
      chainId: TENDERLY_CHAIN_ID,
      account: TEST_WALLET_ADDRESS,
      calls: [codeless, swap]
    }).catch(error => error);

    expect(failure).toBeInstanceOf(BatchSimulationError);
    expect(failure.kind).toBe('reverted');
    expect(failure.callIndex).toBe(0);
    expect(failure.message).toContain('no code');
  });
});
