import { formatUnits } from 'viem';
import {
  TOKENS,
  getTokenDecimals,
  lsSkyUsdsRewardAddress,
  lsSkySpkRewardAddress,
  lsSkySkyRewardAddress
} from '@jetstreamgg/sky-hooks';
import type { RewardContract } from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import type { OnchainEventData } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Lightweight GraphQL POST (avoids graphql-request dependency in the webapp). */
async function gqlRequest(url: string, query: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`Subgraph request failed: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

function blockTimestampToISO(blockTimestamp: string): string {
  return new Date(parseInt(blockTimestamp, 10) * 1000).toISOString();
}

function formatAmount(raw: string, decimals: number): number {
  return parseFloat(formatUnits(BigInt(raw), decimals));
}

/**
 * Build an address → { symbol, decimals } lookup map for a given chain.
 * Used to resolve token symbols from subgraph asset addresses.
 */
function buildTokenLookup(chainId: number): Record<string, { symbol: string; decimals: number }> {
  const map: Record<string, { symbol: string; decimals: number }> = {};
  for (const token of Object.values(TOKENS)) {
    const addr = token.address[chainId];
    if (addr) {
      map[addr.toLowerCase()] = {
        symbol: token.symbol,
        decimals: getTokenDecimals(token, chainId)
      };
    }
  }
  return map;
}

/**
 * Build a reward-contract-address → token symbol map for staking/seal engines.
 * These use different reward contracts than the rewards module.
 */
function buildStakeRewardTokenLookup(chainId: number): Record<string, string> {
  const lookup: Record<string, string> = {};
  const usdsAddr = lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress];
  const spkAddr = lsSkySpkRewardAddress[chainId as keyof typeof lsSkySpkRewardAddress];
  const skyAddr = lsSkySkyRewardAddress[chainId as keyof typeof lsSkySkyRewardAddress];
  if (usdsAddr) lookup[usdsAddr.toLowerCase()] = 'USDS';
  if (spkAddr) lookup[spkAddr.toLowerCase()] = 'SPK';
  if (skyAddr) lookup[skyAddr.toLowerCase()] = 'SKY';
  return lookup;
}

// ── Savings (Mainnet) ──────────────────────────────────────────────────────

async function fetchMainnetSavingsEvents(subgraphUrl: string, txHash: string): Promise<OnchainEventData[]> {
  const query = `{
    savingsSupplies(where: { transactionHash: "${txHash}" }) {
      assets
      blockTimestamp
    }
    savingsWithdraws(where: { transactionHash: "${txHash}" }) {
      assets
      blockTimestamp
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const events: OnchainEventData[] = [];

  for (const s of res.savingsSupplies ?? []) {
    events.push({
      event_type: 'supply',
      date: blockTimestampToISO(s.blockTimestamp),
      amount: formatAmount(s.assets, 18),
      token_symbol: 'USDS'
    });
  }
  for (const w of res.savingsWithdraws ?? []) {
    events.push({
      event_type: 'withdraw',
      date: blockTimestampToISO(w.blockTimestamp),
      amount: -formatAmount(w.assets, 18),
      token_symbol: 'USDS'
    });
  }

  return events;
}

// ── Savings (L2) ───────────────────────────────────────────────────────────

async function fetchL2SavingsEvents(
  subgraphUrl: string,
  txHash: string,
  chainId: number
): Promise<OnchainEventData[]> {
  const sUsdsAddress = TOKENS.susds.address[chainId]?.toLowerCase();
  if (!sUsdsAddress) return [];

  const query = `{
    swaps(where: { transactionHash: "${txHash}" }) {
      assetIn
      assetOut
      amountIn
      amountOut
      blockTimestamp
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const tokenLookup = buildTokenLookup(chainId);
  const events: OnchainEventData[] = [];

  for (const swap of res.swaps ?? []) {
    const assetInLower = swap.assetIn.toLowerCase();
    const assetOutLower = swap.assetOut.toLowerCase();
    // Supply: user sends tokens, gets sUSDS (assetOut is sUSDS)
    // Withdraw: user sends sUSDS, gets tokens (assetIn is sUSDS)
    const isWithdraw = assetInLower === sUsdsAddress;
    const tokenAddress = isWithdraw ? assetOutLower : assetInLower;
    const tokenInfo = tokenLookup[tokenAddress];
    const decimals = tokenInfo?.decimals ?? 18;
    const amount = isWithdraw
      ? formatAmount(swap.amountOut, decimals)
      : formatAmount(swap.amountIn, decimals);

    events.push({
      event_type: isWithdraw ? 'withdraw' : 'supply',
      date: blockTimestampToISO(swap.blockTimestamp),
      amount: isWithdraw ? -amount : amount,
      token_symbol: tokenInfo?.symbol ?? 'UNKNOWN'
    });
  }

  return events;
}

export async function fetchSavingsEvents(
  subgraphUrl: string,
  txHash: string,
  chainId: number
): Promise<OnchainEventData[]> {
  if (isL2ChainId(chainId)) {
    return fetchL2SavingsEvents(subgraphUrl, txHash, chainId);
  }
  return fetchMainnetSavingsEvents(subgraphUrl, txHash);
}

// ── Rewards ────────────────────────────────────────────────────────────────

export async function fetchRewardsEvents(
  subgraphUrl: string,
  txHash: string,
  rewardContracts: RewardContract[]
): Promise<OnchainEventData[]> {
  const events: OnchainEventData[] = [];
  const claimedAmounts: Record<string, number> = {};
  let claimTimestamp: string | undefined;

  for (const rc of rewardContracts) {
    if (!rc.contractAddress) continue;

    const query = `{
      reward(id: "${rc.contractAddress.toLowerCase()}") {
        supplyInstances(where: { transactionHash: "${txHash}" }) {
          amount
          blockTimestamp
        }
        withdrawals(where: { transactionHash: "${txHash}" }) {
          amount
          blockTimestamp
        }
        rewardClaims(where: { transactionHash: "${txHash}" }) {
          amount
          blockTimestamp
        }
      }
    }`;

    const res = await gqlRequest(subgraphUrl, query);
    const reward = res.reward;
    if (!reward) continue;

    for (const s of reward.supplyInstances ?? []) {
      events.push({
        event_type: 'supply',
        date: blockTimestampToISO(s.blockTimestamp),
        amount: formatAmount(s.amount, 18),
        token_symbol: rc.supplyToken.symbol,
        product: rc.name,
        product_address: rc.contractAddress
      });
    }
    for (const w of reward.withdrawals ?? []) {
      events.push({
        event_type: 'withdraw',
        date: blockTimestampToISO(w.blockTimestamp),
        amount: -formatAmount(w.amount, 18),
        token_symbol: rc.supplyToken.symbol,
        product: rc.name,
        product_address: rc.contractAddress
      });
    }
    for (const c of reward.rewardClaims ?? []) {
      const symbol = rc.rewardToken.symbol;
      claimedAmounts[`claimed_${symbol}`] =
        (claimedAmounts[`claimed_${symbol}`] ?? 0) + formatAmount(c.amount, 18);
      if (!claimTimestamp || c.blockTimestamp > claimTimestamp) claimTimestamp = c.blockTimestamp;
    }
  }

  if (claimTimestamp && Object.keys(claimedAmounts).length > 0) {
    events.push({
      event_type: 'reward_claimed',
      date: blockTimestampToISO(claimTimestamp),
      amount: 0,
      token_symbol: 'USDS',
      ...claimedAmounts
    });
  }

  return events;
}

// ── stUSDS (Expert) ────────────────────────────────────────────────────────

const CURVE_USDS_INDEX = 0;

export async function fetchStUsdsEvents(subgraphUrl: string, txHash: string): Promise<OnchainEventData[]> {
  const query = `{
    stusdsDeposits(where: { transactionHash: "${txHash}" }) {
      assets
      blockTimestamp
    }
    stusdsWithdraws(where: { transactionHash: "${txHash}" }) {
      assets
      blockTimestamp
    }
    curveTokenExchanges(where: { transactionHash: "${txHash}" }) {
      soldId
      amountSold
      boughtId
      amountBought
      blockTimestamp
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const events: OnchainEventData[] = [];

  for (const d of res.stusdsDeposits ?? []) {
    events.push({
      event_type: 'supply',
      date: blockTimestampToISO(d.blockTimestamp),
      amount: formatAmount(d.assets, 18),
      token_symbol: 'USDS',
      product: 'stUSDS'
    });
  }
  for (const w of res.stusdsWithdraws ?? []) {
    events.push({
      event_type: 'withdraw',
      date: blockTimestampToISO(w.blockTimestamp),
      amount: -formatAmount(w.assets, 18),
      token_symbol: 'USDS',
      product: 'stUSDS'
    });
  }
  for (const c of res.curveTokenExchanges ?? []) {
    const isSupply = parseInt(c.soldId) === CURVE_USDS_INDEX;

    events.push({
      event_type: isSupply ? 'supply' : 'withdraw',
      date: blockTimestampToISO(c.blockTimestamp),
      amount: isSupply ? formatAmount(c.amountSold, 18) : -formatAmount(c.amountBought, 18),
      token_symbol: 'USDS',
      product: 'stUSDS'
    });
  }

  return events;
}

// ── SKY Staking ────────────────────────────────────────────────────────────

export async function fetchStakeEvents(
  subgraphUrl: string,
  txHash: string,
  chainId: number
): Promise<OnchainEventData[]> {
  const query = `{
    stakingLocks(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    stakingFrees(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    stakingDraws(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    stakingWipes(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    stakingGetRewards(where: { transactionHash: "${txHash}" }) {
      amt
      reward
      blockTimestamp
      index
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const events: OnchainEventData[] = [];

  const locks = res.stakingLocks ?? [];
  const frees = res.stakingFrees ?? [];
  const draws = res.stakingDraws ?? [];
  const wipes = res.stakingWipes ?? [];
  const getRewards = res.stakingGetRewards ?? [];
  const hasLockOrFree = locks.length > 0 || frees.length > 0;

  // Sum borrow/repay amounts to merge into the stake/unstake event
  const totalBorrow = draws.reduce((sum: number, d: any) => sum + formatAmount(d.wad, 18), 0);
  const totalRepay = wipes.reduce((sum: number, w: any) => sum + formatAmount(w.wad, 18), 0);
  const borrowProps =
    totalBorrow > 0
      ? { borrow_amount: totalBorrow, borrow_type: 'borrow' as const }
      : totalRepay > 0
        ? { borrow_amount: -totalRepay, borrow_type: 'repay' as const }
        : undefined;

  // Build claimed_<TOKEN> amounts to merge into stake/unstake or emit standalone
  const rewardLookup = buildStakeRewardTokenLookup(chainId);
  const claimedAmounts: Record<string, number> = {};
  for (const r of getRewards) {
    const symbol = rewardLookup[r.reward?.toLowerCase()] ?? 'UNKNOWN';
    claimedAmounts[`claimed_${symbol}`] =
      (claimedAmounts[`claimed_${symbol}`] ?? 0) + formatAmount(r.amt, 18);
  }
  const hasClaimed = Object.keys(claimedAmounts).length > 0;

  for (const l of locks) {
    events.push({
      event_type: 'stake',
      date: blockTimestampToISO(l.blockTimestamp),
      amount: formatAmount(l.wad, 18),
      token_symbol: 'SKY',
      urn_index: l.index != null ? Number(l.index) : undefined,
      ...borrowProps,
      ...(hasClaimed && claimedAmounts)
    });
  }
  for (const f of frees) {
    events.push({
      event_type: 'unstake',
      date: blockTimestampToISO(f.blockTimestamp),
      amount: -formatAmount(f.wad, 18),
      token_symbol: 'SKY',
      urn_index: f.index != null ? Number(f.index) : undefined,
      ...borrowProps,
      ...(hasClaimed && claimedAmounts)
    });
  }

  // Standalone borrow/repay (no lock/free in same tx)
  if (!hasLockOrFree) {
    for (const d of draws) {
      events.push({
        event_type: 'borrow',
        date: blockTimestampToISO(d.blockTimestamp),
        amount: formatAmount(d.wad, 18),
        token_symbol: 'USDS',
        urn_index: d.index != null ? Number(d.index) : undefined
      });
    }
    for (const w of wipes) {
      events.push({
        event_type: 'repay',
        date: blockTimestampToISO(w.blockTimestamp),
        amount: -formatAmount(w.wad, 18),
        token_symbol: 'USDS',
        urn_index: w.index != null ? Number(w.index) : undefined
      });
    }
  }

  // Standalone reward claim (no lock/free in same tx)
  if (hasClaimed && !hasLockOrFree) {
    const claimUrnIndex = getRewards[0]?.index != null ? Number(getRewards[0].index) : undefined;
    events.push({
      event_type: 'reward_claimed',
      date: blockTimestampToISO(getRewards[getRewards.length - 1].blockTimestamp),
      amount: 0,
      token_symbol: 'SKY',
      urn_index: claimUrnIndex,
      ...claimedAmounts
    });
  }

  return events;
}

// ── Seal ───────────────────────────────────────────────────────────────────

export async function fetchSealEvents(
  subgraphUrl: string,
  txHash: string,
  chainId: number
): Promise<OnchainEventData[]> {
  const query = `{
    sealLocks(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    sealLockSkies(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    sealFrees(where: { transactionHash: "${txHash}" }) {
      freed
      blockTimestamp
      index
    }
    sealFreeSkies(where: { transactionHash: "${txHash}" }) {
      skyFreed
      blockTimestamp
      index
    }
    sealDraws(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    sealWipes(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
      index
    }
    sealGetRewards(where: { transactionHash: "${txHash}" }) {
      amt
      reward
      blockTimestamp
      index
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const events: OnchainEventData[] = [];

  const mkrLocks = res.sealLocks ?? [];
  const skyLocks = res.sealLockSkies ?? [];
  const mkrFrees = res.sealFrees ?? [];
  const skyFrees = res.sealFreeSkies ?? [];
  const draws = res.sealDraws ?? [];
  const wipes = res.sealWipes ?? [];
  const sealRewards = res.sealGetRewards ?? [];
  const hasLockOrFree =
    mkrLocks.length > 0 || skyLocks.length > 0 || mkrFrees.length > 0 || skyFrees.length > 0;

  // Sum borrow/repay amounts to merge into the stake/unstake event
  const totalBorrow = draws.reduce((sum: number, d: any) => sum + formatAmount(d.wad, 18), 0);
  const totalRepay = wipes.reduce((sum: number, w: any) => sum + formatAmount(w.wad, 18), 0);
  const borrowProps =
    totalBorrow > 0
      ? { borrow_amount: totalBorrow, borrow_type: 'borrow' as const }
      : totalRepay > 0
        ? { borrow_amount: -totalRepay, borrow_type: 'repay' as const }
        : undefined;

  // Build claimed_<TOKEN> amounts to merge into stake/unstake or emit standalone
  const rewardLookup = buildStakeRewardTokenLookup(chainId);
  const claimedAmounts: Record<string, number> = {};
  for (const r of sealRewards) {
    const symbol = rewardLookup[r.reward?.toLowerCase()] ?? 'UNKNOWN';
    claimedAmounts[`claimed_${symbol}`] =
      (claimedAmounts[`claimed_${symbol}`] ?? 0) + formatAmount(r.amt, 18);
  }
  const hasClaimed = Object.keys(claimedAmounts).length > 0;

  for (const l of mkrLocks) {
    events.push({
      event_type: 'stake',
      date: blockTimestampToISO(l.blockTimestamp),
      amount: formatAmount(l.wad, 18),
      token_symbol: 'MKR',
      urn_index: l.index != null ? Number(l.index) : undefined,
      ...borrowProps,
      ...(hasClaimed && claimedAmounts)
    });
  }
  for (const l of skyLocks) {
    events.push({
      event_type: 'stake',
      date: blockTimestampToISO(l.blockTimestamp),
      amount: formatAmount(l.wad, 18),
      token_symbol: 'SKY',
      urn_index: l.index != null ? Number(l.index) : undefined,
      ...borrowProps,
      ...(hasClaimed && claimedAmounts)
    });
  }
  for (const f of mkrFrees) {
    events.push({
      event_type: 'unstake',
      date: blockTimestampToISO(f.blockTimestamp),
      amount: -formatAmount(f.freed, 18),
      token_symbol: 'MKR',
      urn_index: f.index != null ? Number(f.index) : undefined,
      ...borrowProps,
      ...(hasClaimed && claimedAmounts)
    });
  }
  for (const f of skyFrees) {
    events.push({
      event_type: 'unstake',
      date: blockTimestampToISO(f.blockTimestamp),
      amount: -formatAmount(f.skyFreed, 18),
      token_symbol: 'SKY',
      urn_index: f.index != null ? Number(f.index) : undefined,
      ...borrowProps,
      ...(hasClaimed && claimedAmounts)
    });
  }

  // Standalone borrow/repay (no lock/free in same tx)
  if (!hasLockOrFree) {
    for (const d of draws) {
      events.push({
        event_type: 'borrow',
        date: blockTimestampToISO(d.blockTimestamp),
        amount: formatAmount(d.wad, 18),
        token_symbol: 'USDS',
        urn_index: d.index != null ? Number(d.index) : undefined
      });
    }
    for (const w of wipes) {
      events.push({
        event_type: 'repay',
        date: blockTimestampToISO(w.blockTimestamp),
        amount: -formatAmount(w.wad, 18),
        token_symbol: 'USDS',
        urn_index: w.index != null ? Number(w.index) : undefined
      });
    }
  }

  // Standalone reward claim (no lock/free in same tx)
  if (hasClaimed && !hasLockOrFree) {
    const claimUrnIndex = sealRewards[0]?.index != null ? Number(sealRewards[0].index) : undefined;
    events.push({
      event_type: 'reward_claimed',
      date: blockTimestampToISO(sealRewards[sealRewards.length - 1].blockTimestamp),
      amount: 0,
      token_symbol: 'MKR',
      urn_index: claimUrnIndex,
      ...claimedAmounts
    });
  }

  return events;
}

// ── Upgrade ────────────────────────────────────────────────────────────────

export async function fetchUpgradeEvents(subgraphUrl: string, txHash: string): Promise<OnchainEventData[]> {
  const query = `{
    daiToUsdsUpgrades(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
    }
    usdsToDaiReverts(where: { transactionHash: "${txHash}" }) {
      wad
      blockTimestamp
    }
    mkrToSkyUpgrades(where: { transactionHash: "${txHash}" }) {
      mkrAmt
      skyAmt
      blockTimestamp
    }
    mkrToSkyUpgradeV2S(where: { transactionHash: "${txHash}" }) {
      mkrAmt
      skyAmt
      blockTimestamp
    }
    skyToMkrReverts(where: { transactionHash: "${txHash}" }) {
      mkrAmt
      skyAmt
      blockTimestamp
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const events: OnchainEventData[] = [];

  for (const u of res.daiToUsdsUpgrades ?? []) {
    events.push({
      event_type: 'upgrade',
      date: blockTimestampToISO(u.blockTimestamp),
      amount: formatAmount(u.wad, 18),
      token_symbol: 'DAI'
    });
  }
  for (const r of res.usdsToDaiReverts ?? []) {
    events.push({
      event_type: 'revert',
      date: blockTimestampToISO(r.blockTimestamp),
      amount: -formatAmount(r.wad, 18),
      token_symbol: 'USDS'
    });
  }
  for (const u of [...(res.mkrToSkyUpgrades ?? []), ...(res.mkrToSkyUpgradeV2S ?? [])]) {
    events.push({
      event_type: 'upgrade',
      date: blockTimestampToISO(u.blockTimestamp),
      amount: formatAmount(u.mkrAmt, 18),
      token_symbol: 'MKR'
    });
  }
  for (const r of res.skyToMkrReverts ?? []) {
    events.push({
      event_type: 'revert',
      date: blockTimestampToISO(r.blockTimestamp),
      amount: -formatAmount(r.skyAmt, 18),
      token_symbol: 'SKY'
    });
  }

  return events;
}

// ── Trade (PSM) ────────────────────────────────────────────────────────────

export async function fetchPsmTradeEvents(
  subgraphUrl: string,
  txHash: string,
  chainId: number
): Promise<OnchainEventData[]> {
  const query = `{
    swaps(where: { transactionHash: "${txHash}" }) {
      assetIn
      assetOut
      amountIn
      amountOut
      blockTimestamp
    }
  }`;

  const res = await gqlRequest(subgraphUrl, query);
  const tokenLookup = buildTokenLookup(chainId);
  const events: OnchainEventData[] = [];

  for (const swap of res.swaps ?? []) {
    const fromInfo = tokenLookup[swap.assetIn.toLowerCase()];
    const toInfo = tokenLookup[swap.assetOut.toLowerCase()];
    const fromDecimals = fromInfo?.decimals ?? 18;
    const toDecimals = toInfo?.decimals ?? 18;

    events.push({
      event_type: 'trade',
      date: blockTimestampToISO(swap.blockTimestamp),
      amount: 0,
      token_symbol: fromInfo?.symbol ?? 'UNKNOWN',
      amount_from: formatAmount(swap.amountIn, fromDecimals),
      amount_to: formatAmount(swap.amountOut, toDecimals),
      token_address_from: swap.assetIn,
      token_address_to: swap.assetOut,
      token_symbol_from: fromInfo?.symbol ?? 'UNKNOWN',
      token_symbol_to: toInfo?.symbol ?? 'UNKNOWN'
    });
  }

  return events;
}

// ── Trade (CowSwap) ───────────────────────────────────────────────────────

const COW_API_ENDPOINTS: Record<number, string> = {
  1: 'https://api.cow.fi/mainnet',
  8453: 'https://api.cow.fi/base',
  42161: 'https://api.cow.fi/arbitrum_one'
};

export async function fetchCowSwapTradeEvents(
  orderUid: string,
  chainId: number
): Promise<OnchainEventData[]> {
  const baseUrl = COW_API_ENDPOINTS[chainId];
  if (!baseUrl) return [];

  const response = await fetch(`${baseUrl}/api/v1/orders/${orderUid}`);
  if (!response.ok) return [];

  const order = await response.json();
  const tokenLookup = buildTokenLookup(chainId);

  const sellInfo = tokenLookup[order.sellToken?.toLowerCase()];
  const buyInfo = tokenLookup[order.buyToken?.toLowerCase()];
  const sellDecimals = sellInfo?.decimals ?? 18;
  const buyDecimals = buyInfo?.decimals ?? 18;

  const sellAmount = order.executedSellAmount || '0';
  const buyAmount = order.executedBuyAmount || '0';

  if (sellAmount === '0' && buyAmount === '0') return [];

  return [
    {
      event_type: 'trade',
      date: order.creationDate ?? new Date().toISOString(),
      amount: 0,
      token_symbol: sellInfo?.symbol ?? 'UNKNOWN',
      amount_from: formatAmount(sellAmount, sellDecimals),
      amount_to: formatAmount(buyAmount, buyDecimals),
      token_address_from: order.sellToken,
      token_address_to: order.buyToken,
      token_symbol_from: sellInfo?.symbol ?? 'UNKNOWN',
      token_symbol_to: buyInfo?.symbol ?? 'UNKNOWN'
    }
  ];
}
