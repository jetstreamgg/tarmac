import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  numberToHex,
  parseAbi,
  stringToHex,
  type Address
} from 'viem';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

/**
 * On-chain oracle + staging helpers for the stake V2 e2e suite (F10).
 *
 * The mock wallet's `wallet_sendCalls` is non-atomic and reports
 * optimistically — a mid-bundle revert can still render the success screen —
 * so stake specs assert outcomes here (vat.urns ink/art, farm earned(),
 * ERC-20 balances) instead of trusting success copy.
 *
 * Addresses are the mainnet Sky deployment, identical on the Tenderly fork
 * (same convention as setOsmSpotPrice.ts).
 */

export const STAKE_ENGINE: Address = '0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3';
export const VAT: Address = '0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B';
export const DOG: Address = '0x135954d155898D42C90D2a57824C690e0c7BEf1B';
export const JUG: Address = '0x19c0976f590D67707E62397C87829d896Dc0f1F1';
export const LOCKSTAKE_CLIPPER: Address = '0x836F56750517b1528B5078Cba4Ac4B94fBE4A399';
export const SKY_TOKEN: Address = '0x56072C95FAA701256059aa122697B133aDEd9279';
export const USDS_TOKEN: Address = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
export const SKY_FARM: Address = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc'; // pays SKY (open-flow default)
export const USDS_FARM: Address = '0x38E4254bD82ED5Ee97CD1C4278FAae748d998865'; // pays USDS
export const SPK_FARM: Address = '0x99cBC0e4E6427F6939536eD24d1275B95ff77404'; // pays SPK

export const STAKE_ILK = stringToHex('LSEV2-SKY-A', { size: 32 });
/** The unpadded ilk hex string as the subgraph indexes it on Bark entities. */
export const STAKE_ILK_SUBGRAPH = stringToHex('LSEV2-SKY-A');

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;

const abi = parseAbi([
  'function ownerUrnsCount(address) view returns (uint256)',
  'function ownerUrns(address, uint256) view returns (address)',
  'function urnFarms(address) view returns (address)',
  'function urnVoteDelegates(address) view returns (address)',
  'function open(uint256 index) returns (address urn)',
  'function lock(address owner, uint256 index, uint256 wad, uint16 ref)',
  'function draw(address owner, uint256 index, address to, uint256 wad)',
  'function urns(bytes32, address) view returns (uint256 ink, uint256 art)',
  'function ilks(bytes32) view returns (uint256 Art, uint256 rate, uint256 spot, uint256 line, uint256 dust)',
  'function hope(address)',
  'function drip(bytes32) returns (uint256)',
  'function bark(bytes32 ilk, address urn, address kpr) returns (uint256 id)',
  'function kicks() view returns (uint256)',
  'function stopped() view returns (uint256)',
  // LockstakeClipper sales — 8 words on this deploy:
  // (pos, tab, prevTab, lot, tot, usr, tic, top). take() caps `amt` at the
  // remaining lot, and `max` must be >= the current Dutch price (top at kick).
  'function sales(uint256) view returns (uint256 pos, uint256 tab, uint256 prevTab, uint256 lot, uint256 tot, address usr, uint96 tic, uint256 top)',
  'function take(uint256 id, uint256 amt, uint256 max, address who, bytes data)',
  'function earned(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)'
]);

async function clients() {
  const rpcUrl = await getRpcUrlFromFile(NetworkName.mainnet);
  return { rpcUrl, pub: createPublicClient({ transport: http(rpcUrl) }) };
}

/** Raw JSON-RPC for Tenderly cheat methods (same style as setOsmSpotPrice.ts). */
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

/** Tenderly-impersonated write (no key needed on a vnet), mined before returning. */
async function sendAs(rpcUrl: string, from: Address, to: Address, functionName: string, args: unknown[]) {
  const pub = createPublicClient({ transport: http(rpcUrl) });
  const wallet = createWalletClient({ account: from, transport: http(rpcUrl) });
  const hash = await wallet.writeContract({ address: to, abi, functionName, args, chain: null } as never);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted (${hash})`);
  return { hash, receipt };
}

export async function getUrnAddress(owner: Address, index: bigint): Promise<Address> {
  const { pub } = await clients();
  return pub.readContract({ address: STAKE_ENGINE, abi, functionName: 'ownerUrns', args: [owner, index] });
}

export async function getUrnInkArt(urn: Address): Promise<{ ink: bigint; art: bigint }> {
  const { pub } = await clients();
  const [ink, art] = await pub.readContract({
    address: VAT,
    abi,
    functionName: 'urns',
    args: [STAKE_ILK, urn]
  });
  return { ink, art };
}

/** Current debt in USDS wad (art × rate / RAY), including accrued stability fee. */
export async function getUrnDebt(urn: Address): Promise<bigint> {
  const { pub } = await clients();
  const [, art] = await pub.readContract({ address: VAT, abi, functionName: 'urns', args: [STAKE_ILK, urn] });
  const [, rate] = await pub.readContract({ address: VAT, abi, functionName: 'ilks', args: [STAKE_ILK] });
  return (art * rate) / RAY;
}

export async function getUrnVoteDelegate(urn: Address): Promise<Address> {
  const { pub } = await clients();
  return pub.readContract({ address: STAKE_ENGINE, abi, functionName: 'urnVoteDelegates', args: [urn] });
}

export async function getUrnFarm(urn: Address): Promise<Address> {
  const { pub } = await clients();
  return pub.readContract({ address: STAKE_ENGINE, abi, functionName: 'urnFarms', args: [urn] });
}

export async function getEarned(farm: Address, urn: Address): Promise<bigint> {
  const { pub } = await clients();
  return pub.readContract({ address: farm, abi, functionName: 'earned', args: [urn] });
}

export async function getTokenBalance(token: Address, account: Address): Promise<bigint> {
  const { pub } = await clients();
  return pub.readContract({ address: token, abi, functionName: 'balanceOf', args: [account] });
}

/**
 * Credit a farm's `rewards[urn]` checkpoint (StakingRewards storage slot 12)
 * so `earned(urn)` returns exactly `wad` — deterministic claimables without
 * waiting out real emissions.
 */
export async function mintFarmReward(farm: Address, urn: Address, wad: bigint): Promise<void> {
  const { rpcUrl } = await clients();
  const slot = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [urn, 12n]));
  await cheat(rpcUrl, 'tenderly_setStorageAt', [farm, slot, numberToHex(wad, { size: 32 })]);
}

export type StagedLiquidation = {
  urnIndex: bigint;
  urn: Address;
  /** Collateral left in the urn after the auction refund (WAD). */
  residualInk: bigint;
  /** Field values for a subgraph Bark entity mirroring the real on-chain bark. */
  bark: {
    clipperId: string;
    ink: string;
    art: string;
    due: string;
    blockTimestamp: number;
    transactionHash: string;
  };
};

/**
 * Stage a genuinely liquidated-and-auctioned urn for `owner` via direct engine
 * calls: lock 2M SKY, draw to the safety edge, warp a day (+drip) until the
 * position turns unsafe, bark, then take the auction at the opening Dutch
 * price so most collateral refunds to the urn. Only the subgraph "news" of the
 * bark has to be fabricated by the caller (the e2e vnet has no indexer) — the
 * returned `bark` fields mirror the real transaction.
 */
export async function stageLiquidatedUrn(owner: Address): Promise<StagedLiquidation> {
  const { rpcUrl, pub } = await clients();
  // Sized off the LIVE vat state, because forks inherit mainnet's OSM and it
  // has swung 10× between fork days ($0.025 → $0.0025): the debt must clear
  // the dust floor, and its chop-inclusive tab must stay under the Dog's
  // 250K `hole` — a larger position gets only PARTIALLY barked, leaving
  // residual art the recovery flow can't handle. Target debt = dust × 1.25;
  // ink = whatever collateral puts that debt a hair under the safety edge
  // (ink × spot), rounded up to a whole SKY.
  const [, , spot, , dustRad] = await pub.readContract({
    address: VAT,
    abi,
    functionName: 'ilks',
    args: [STAKE_ILK]
  });
  const targetDebt = ((dustRad / RAY) * 125n) / 100n;
  const lockWad = ((targetDebt * RAY) / spot / WAD + 1n) * WAD;

  // Collateral allowance (test accounts are funded with 100M SKY).
  await sendAs(rpcUrl, owner, SKY_TOKEN, 'approve', [STAKE_ENGINE, 2n ** 256n - 1n]);

  const urnIndex = await pub.readContract({
    address: STAKE_ENGINE,
    abi,
    functionName: 'ownerUrnsCount',
    args: [owner]
  });
  await sendAs(rpcUrl, owner, STAKE_ENGINE, 'open', [urnIndex]);
  const urn = await getUrnAddress(owner, urnIndex);
  await sendAs(rpcUrl, owner, STAKE_ENGINE, 'lock', [owner, urnIndex, lockWad, 0]);

  // Draw to a hair under the vat safety edge (ink × spot).
  const maxDebt = (lockWad * spot) / RAY;
  await sendAs(rpcUrl, owner, STAKE_ENGINE, 'draw', [owner, urnIndex, owner, maxDebt - 6n * WAD]);

  // Let the stability fee push the position underwater (retry the warp in
  // case a day of accrual isn't enough at the current duty).
  let unsafe = false;
  for (let attempt = 0; attempt < 3 && !unsafe; attempt++) {
    await cheat(rpcUrl, 'evm_increaseTime', [numberToHex(86400n)]);
    await sendAs(rpcUrl, owner, JUG, 'drip', [STAKE_ILK]);
    const { ink, art } = await getUrnInkArt(urn);
    const [, rate, spotNow] = await pub.readContract({
      address: VAT,
      abi,
      functionName: 'ilks',
      args: [STAKE_ILK]
    });
    unsafe = ink * spotNow < art * rate;
  }
  if (!unsafe) throw new Error('stageLiquidatedUrn: position still safe after 3 day-warps');
  const { art: artAtBark } = await getUrnInkArt(urn);

  // The mainnet LockstakeClipper ships stopped — clear the breaker (slot 16).
  const stopped = await pub.readContract({
    address: LOCKSTAKE_CLIPPER,
    abi,
    functionName: 'stopped',
    args: []
  });
  if (stopped !== 0n) {
    await cheat(rpcUrl, 'tenderly_setStorageAt', [
      LOCKSTAKE_CLIPPER,
      numberToHex(16n, { size: 32 }),
      numberToHex(0n, { size: 32 })
    ]);
    const recheck = await pub.readContract({
      address: LOCKSTAKE_CLIPPER,
      abi,
      functionName: 'stopped',
      args: []
    });
    if (recheck !== 0n) throw new Error('stageLiquidatedUrn: could not un-stop the LockstakeClipper');
  }

  const { hash: barkHash, receipt: barkReceipt } = await sendAs(rpcUrl, owner, DOG, 'bark', [
    STAKE_ILK,
    urn,
    owner
  ]);
  const barkBlock = await pub.getBlock({ blockNumber: barkReceipt.blockNumber });
  const kickId = await pub.readContract({ address: LOCKSTAKE_CLIPPER, abi, functionName: 'kicks', args: [] });
  const sale = await pub.readContract({
    address: LOCKSTAKE_CLIPPER,
    abi,
    functionName: 'sales',
    args: [kickId]
  });
  const [, tab, , lot, , , , top] = sale;

  // Settle the auction: hand the keeper (owner) vat dai via storage (dai
  // mapping is vat slot 5), hope the clipper, take the full lot at the
  // opening price — take() trims the slice to the tab, refunding the rest of
  // the collateral to the urn.
  const daiSlot = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [owner, 5n]));
  await cheat(rpcUrl, 'tenderly_setStorageAt', [
    VAT,
    daiSlot,
    numberToHex(10n ** 12n * 10n ** 45n, { size: 32 })
  ]);
  await sendAs(rpcUrl, owner, VAT, 'hope', [LOCKSTAKE_CLIPPER]);
  await sendAs(rpcUrl, owner, LOCKSTAKE_CLIPPER, 'take', [kickId, lot, top, owner, '0x']);

  const { ink: residualInk, art: artAfter } = await getUrnInkArt(urn);
  if (artAfter !== 0n) throw new Error(`stageLiquidatedUrn: auction left residual debt (art=${artAfter})`);

  return {
    urnIndex,
    urn,
    residualInk,
    bark: {
      clipperId: kickId.toString(),
      ink: lockWad.toString(),
      art: artAtBark.toString(),
      due: tab.toString(),
      blockTimestamp: Number(barkBlock.timestamp),
      transactionHash: barkHash
    }
  };
}
