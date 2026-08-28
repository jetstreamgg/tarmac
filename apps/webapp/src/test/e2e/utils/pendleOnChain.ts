import {
  createPublicClient,
  encodeAbiParameters,
  erc20Abi,
  http,
  keccak256,
  numberToHex,
  parseUnits,
  type Address
} from 'viem';
import type { Page } from '@playwright/test';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { PT_SUSDS_EXPIRY_SEC, PT_SUSDS_PT_TOKEN } from './pendleE2e';

/** Raw JSON-RPC for Tenderly cheat methods (same style as stakeOnChain.ts). */
async function cheat(rpcUrl: string, method: string, params: unknown[]): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  if (!response.ok) throw new Error(`${method} failed: ${response.statusText}`);
  const data = await response.json();
  if (data.error) throw new Error(`${method} RPC error: ${JSON.stringify(data.error)}`);
}

async function rpcUrlFor(network = NetworkName.mainnet): Promise<string> {
  return getRpcUrlFromFile(network);
}

/** Credit PT-sUSDS on the Tenderly fork via storage-slot overwrite. */
export async function cheatMintPtSusds(
  account: Address,
  amount = '100',
  network = NetworkName.mainnet
): Promise<void> {
  const rpcUrl = await rpcUrlFor(network);
  const pub = createPublicClient({ transport: http(rpcUrl) });
  const code = await pub.getCode({ address: PT_SUSDS_PT_TOKEN });
  if (!code || code === '0x') {
    throw new Error(`cheatMintPtSusds: PT-sUSDS not deployed on ${network} fork`);
  }

  const wad = parseUnits(amount, 18);
  const slot = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [account, 0n]));
  await cheat(rpcUrl, 'tenderly_setStorageAt', [
    PT_SUSDS_PT_TOKEN,
    slot,
    numberToHex(wad, { size: 32 })
  ]);
  await cheat(rpcUrl, 'evm_mine', []);

  const balance = await pub.readContract({
    address: PT_SUSDS_PT_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account]
  });
  if (balance !== wad) {
    throw new Error(`cheatMintPtSusds: expected ${wad}, got ${balance} for ${account}`);
  }
}

/** Warp the shared vnet clock past a Pendle market expiry. */
export async function advanceChainPastPendleExpiry(
  expirySec = PT_SUSDS_EXPIRY_SEC,
  network = NetworkName.mainnet
): Promise<void> {
  const rpcUrl = await rpcUrlFor(network);
  const pub = createPublicClient({ transport: http(rpcUrl) });
  const block = await pub.getBlock();
  const now = Number(block.timestamp);
  if (now <= expirySec) {
    const delta = expirySec - now + 86_400;
    await cheat(rpcUrl, 'evm_increaseTime', [numberToHex(BigInt(delta))]);
    await cheat(rpcUrl, 'evm_mine', []);
  }
}

/** Pendle UI maturity uses `Date.now()` — freeze one day past expiry before goto. */
export async function installPendleUiMaturity(
  page: Page,
  expirySec = PT_SUSDS_EXPIRY_SEC
): Promise<void> {
  // Prefer Date override over page.clock — fake clocks freeze timers and stall
  // React Query / wagmi settlement on Portfolio.
  await page.addInitScript(expiry => {
    const frozenMs = (expiry + 86_400) * 1000;
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date> | []) {
        if (args.length === 0) super(frozenMs);
        else super(...(args as ConstructorParameters<typeof Date>));
      }
      static now() {
        return frozenMs;
      }
    }
    Object.assign(FrozenDate, {
      parse: RealDate.parse,
      UTC: RealDate.UTC
    });
    (globalThis as { Date: typeof Date }).Date = FrozenDate;
  }, expirySec);
}

/** Stage UI clock + chain warp + on-chain PT balance for matured Portfolio e2e. */
export async function stageMaturedPtSusdsPosition(
  page: Page,
  account: Address,
  options?: { ptAmount?: string; expirySec?: number; network?: NetworkName }
): Promise<void> {
  const expirySec = options?.expirySec ?? PT_SUSDS_EXPIRY_SEC;
  const network = options?.network ?? NetworkName.mainnet;
  const ptAmount = options?.ptAmount ?? '100';

  await installPendleUiMaturity(page, expirySec);
  await cheatMintPtSusds(account, ptAmount, network);
  await advanceChainPastPendleExpiry(expirySec, network);
}
