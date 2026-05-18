# Withdrawing from the SEAL Engine via Etherscan

The SEAL Engine UI has been removed from the app. The SEAL Engine was deprecated by Sky governance on **April 22, 2025** (MakerDAO Poll `Qmctp1eN`) and replaced by the SKY Staking Engine. Any remaining positions can be withdrawn directly on-chain via Etherscan.

The on-chain exit fee is **0** — users withdraw 100% of their position.

## Which engine are you in?

There are two SEAL Engine deployments. Check both — your position may be in either.

| Contract             | Address                                      | Denomination |
| -------------------- | -------------------------------------------- | ------------ |
| LockstakeEngine (v2) | `0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3` | SKY          |
| LockstakeEngine (v1) | `0x2b16C07D5fD5cC701a0a871eae2aad6DA5fc8f12` | MKR (legacy) |

## Step 1 — Find your urn index

On the appropriate engine's Etherscan page, open **Contract → Read Contract** and connect your wallet.

1. Call `ownerUrnsCount(<yourAddress>)`. Most users have exactly one urn at index `0`.
2. If you have multiple urns, repeat the withdrawal steps below for each index.
3. Call `urns(<yourAddress>, <index>)` to see your locked balance (in 18-decimal units) and any outstanding USDS debt.

## Step 2 — Repay USDS debt (skip if you have no debt)

If `urns(...)` shows non-zero `art` (debt), repay it before withdrawing collateral. `free` will revert otherwise.

1. On the **USDS token contract**, call `approve(<engineAddress>, <amount>)` with an amount ≥ your debt. A safe choice is `2^256 - 1` (max uint256).
2. On the engine's **Write Contract** tab, call `wipeAll(<yourAddress>, <index>)` to repay the full debt.

## Step 3 — Withdraw your collateral

On the engine's **Write Contract** tab:

```
free(
  owner: <yourAddress>,
  index: <urnIndex>,
  to:    <yourAddress>,
  wad:   <amountIn18Decimals>
)
```

Use the `ink` value from `urns(...)` as `wad` to withdraw everything. Tokens are sent directly to the `to` address.

## Notes & gotchas

- `wad` values are 18-decimal — SKY in v2, MKR in v1.
- `free` reverts if any USDS debt remains — always `wipeAll` first.
- If `urnFarms(<urnAddress>)` is non-zero, `free` auto-withdraws from the farm; no explicit `selectFarm(0x0)` is required.
- To claim pending rewards before withdrawing, call `getReward(<owner>, <index>, <farm>, <to>)`.
- Only the position owner can call these functions, unless `hope(<owner>, <index>, <delegate>)` has been set.

## Support

If you can't complete the withdrawal, contact support with your wallet address and the engine version (v1 or v2) so we can help diagnose.
