/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { encodeFunctionData, getAddress, type Call } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  BASE_BURN_AMOUNT,
  BASE_BURN_ATTESTED,
  BASE_BURN_MINT_RECIPIENT,
  ETHEREUM_RECEIVE_INPUT
} from '../adapters/cctp/cctp.fixtures';
import { L1_USDC, USDS_PSM_WRAPPER } from '../adapters/cctp/contracts';
import { useCctpClaimLegs } from './useCctpClaimLegs';

const mocks = vi.hoisted(() => ({
  allowance: undefined as undefined | Record<string, unknown>,
  usdc: 0n as bigint | undefined,
  allowanceError: null as Error | null,
  legs: undefined as undefined | Record<string, unknown>,
  refusal: vi.fn()
}));

vi.mock('wagmi', () => ({ usePublicClient: () => ({ chain: 'ethereum' }) }));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (params: Record<string, unknown>) => {
    mocks.allowance = params;
    return {
      data: params.contractAddress ? mocks.usdc : undefined,
      error: mocks.allowanceError,
      mutate: vi.fn()
    };
  }
}));
vi.mock('../adapters/cctp/gate', () => ({ cctpClaimRefusal: mocks.refusal }));
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (params: Record<string, unknown>) => {
    mocks.legs = params;
    return { isBatch: false, ready: true, error: null, execute: vi.fn(), reset: vi.fn(), stop: vi.fn() };
  }
}));

const ROUTE_DATA = {
  cctpMessage: BASE_BURN_ATTESTED.message,
  cctpAttestation: BASE_BURN_ATTESTED.attestation
};
const getCallbacks = () => ({}) as TxCallbacks;
const render = (overrides: Partial<Parameters<typeof useCctpClaimLegs>[0]> = {}) =>
  renderHook(() =>
    useCctpClaimLegs({
      enabled: true,
      routeData: ROUTE_DATA,
      chainId: 1,
      account: BASE_BURN_MINT_RECIPIENT,
      getCallbacks,
      ...overrides
    })
  ).result.current;
const names = () => (mocks.legs!.calls as (Call & { functionName: string })[]).map(call => call.functionName);

describe('useCctpClaimLegs (golden: the Ethereum receive of Base burn 0x5bb3d46a…6b6a)', () => {
  beforeEach(() => {
    mocks.allowance = undefined;
    mocks.usdc = 0n;
    mocks.allowanceError = null;
    mocks.legs = undefined;
    mocks.refusal.mockReset();
  });

  it('receives the stored message with the real calldata, then sells the mint for USDS', () => {
    expect(render({ batch: true }).ready).toBe(true);
    expect(mocks.legs).toMatchObject({ chainId: 1, sendFunctionName: 'receiveMessage', batch: true });
    expect(names()).toEqual(['receiveMessage', 'approve', 'sellGem']);
    const receive = encodeFunctionData((mocks.legs!.calls as never[])[0]);
    expect(ETHEREUM_RECEIVE_INPUT.includes(receive.slice(2))).toBe(true);
    expect(mocks.allowance).toEqual({
      chainId: 1,
      contractAddress: L1_USDC,
      owner: getAddress(BASE_BURN_MINT_RECIPIENT),
      spender: USDS_PSM_WRAPPER
    });
  });

  it('skips the approve the allowance covers', () => {
    mocks.usdc = BASE_BURN_AMOUNT;
    render();
    expect(names()).toEqual(['receiveMessage', 'sellGem']);
  });

  it('refuses to claim a message minted to another account', () => {
    const legs = render({ account: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' });
    expect(names()).toEqual([]);
    expect(legs.error).toBeInstanceOf(Error);
  });

  it('builds nothing, and says why, without a stored attested message', () => {
    const legs = render({ routeData: { cctpMessage: BASE_BURN_ATTESTED.message } });
    expect(names()).toEqual([]);
    expect(legs.error).toBeInstanceOf(Error);
    expect(mocks.allowance).toMatchObject({ contractAddress: undefined });
  });

  it('reads and builds nothing while disabled', () => {
    expect(render({ enabled: false }).error).toBeNull();
    expect(mocks.allowance).toMatchObject({ contractAddress: undefined });
    expect(names()).toEqual([]);
  });

  it('builds nothing while the allowance loads, and reports a failed read', () => {
    mocks.usdc = undefined;
    render();
    expect(names()).toEqual([]);
    mocks.allowanceError = new Error('rpc down');
    expect(render().error).toBe(mocks.allowanceError);
  });

  it('reads the message, pauses and liquidity again before the prompt', async () => {
    render();
    mocks.refusal.mockResolvedValue(undefined);
    const client = { chain: 'ethereum' };
    await (mocks.legs!.preflight as (client: unknown) => Promise<unknown>)(client);
    expect(mocks.refusal).toHaveBeenCalledWith({ message: BASE_BURN_ATTESTED.message, client });
  });
});
