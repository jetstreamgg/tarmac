import { decodeFunctionData, encodeFunctionResult, multicall3Abi, type Address, type Hex } from 'viem';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

export const same = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

export class RpcError extends Error {
  constructor(
    message: string,
    readonly data: Hex = '0x'
  ) {
    super(message);
  }
}

export type Rpc = (method: string, params: unknown[]) => Promise<any>;

/** A JSON-RPC caller on a fork; an error carries its revert data. */
export const rpcAt =
  (url: string): Rpc =>
  async (method, params) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const body = await response.json();
    if (body.error) throw new RpcError(`${method}: ${body.error.message}`, body.error.data);
    return body.result;
  };

/**
 * The page batches its reads through Multicall3: when `answerCall` answers one of an aggregate3's
 * calls, answers them all, the fork the rest. Undefined leaves the whole call to the fork.
 */
export async function aggregate3Answer(
  rpc: Rpc,
  { to, data, block }: { to: unknown; data: Hex; block: unknown },
  answerCall: (target: Address, callData: Hex) => Hex | undefined
): Promise<Hex | undefined> {
  if (!same(to, MULTICALL3)) return undefined;
  let calls: readonly { target: Address; callData: Hex }[];
  try {
    const call = decodeFunctionData({ abi: multicall3Abi, data });
    if (call.functionName !== 'aggregate3') return undefined;
    calls = call.args[0];
  } catch {
    return undefined;
  }
  if (!calls.some(({ target, callData }) => answerCall(target, callData))) return undefined;
  const results = await Promise.all(
    calls.map(async ({ target, callData }) => {
      const answered = answerCall(target, callData);
      if (answered) return { success: true, returnData: answered };
      try {
        return {
          success: true,
          returnData: (await rpc('eth_call', [{ to: target, data: callData }, block])) as Hex
        };
      } catch (error) {
        return { success: false, returnData: error instanceof RpcError ? error.data : '0x' };
      }
    })
  );
  return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results });
}
