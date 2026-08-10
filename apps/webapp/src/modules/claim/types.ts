import type { ReactNode } from 'react';
import type { Call } from 'viem';

/** Which claim engine a reward comes from. */
export type ClaimSource = 'merkl' | 'sky-rewards' | 'stake';

/**
 * One claimable reward, normalized across the three engines (Merkl distributor,
 * Sky `getReward` StakingRewards, and the SKY Staking Engine) so both the modal
 * panel and the Portfolio reward tables can render any source the same way. The
 * scoped set is turned back into raw calldata by the owning adapter's
 * `useClaimCalls`.
 */
export type ClaimableReward = {
  /**
   * Stable identity WITHIN a source — used as the React key and the row key.
   * E.g. the Merkl reward-token address, a sky reward-contract address, or
   * `${urnIndex}:${rewardContract}` for a staking position.
   */
  id: string;
  source: ClaimSource;
  tokenSymbol: string;
  /** Full token name for the table's subtitle line (e.g. "Spark token"). */
  tokenName: string;
  /** Pre-rendered token icon (each source resolves its own). */
  icon: ReactNode;
  formattedAmount: string;
  amountUsd: number;
  /** Chain the claim executes on — all three engines are mainnet today. */
  chainId: number;
};

/**
 * What slice of the user's rewards a panel launch targets. A scope-per-launch
 * surface (the vault position card) passes a narrow scope; a section's "Claim
 * all" passes the source-wide scope (`merkl` / `sky-rewards`). Each adapter maps
 * the scope onto its own read (a Merkl scope yields nothing for the sky/stake
 * adapters, etc.).
 *
 * `all` spans every source at once; nothing launches it today (the Portfolio
 * splits Merkl and ecosystem rewards into two sections, each with its own
 * "Claim all"), but the panel still supports it.
 */
export type ClaimScope =
  | { kind: 'all' }
  /** Every Merkl reward token — the Merkl section's "Claim all". */
  | { kind: 'merkl' }
  /** One Merkl reward token — a Merkl table row's "Claim". */
  | { kind: 'merkl-token'; tokenAddress: `0x${string}` }
  /** Every Sky `getReward` contract — the Ecosystem section's "Claim all". */
  | { kind: 'sky-rewards' }
  | { kind: 'vault'; vaultAddress: `0x${string}` }
  | { kind: 'reward-contract'; address: `0x${string}` }
  | { kind: 'stake'; index: bigint };

/** Result of an adapter's claimable read. */
export type ClaimableResult = {
  rewards: ClaimableReward[];
  isLoading: boolean;
  /** Refetches the underlying read — surfaces call it after a successful claim. */
  refresh: () => void;
};

/** Result of an adapter's calldata build for its selected subset. */
export type ClaimCallsResult = {
  calls: Call[];
  /** Whether the calls are ready to submit (proofs resolved, allowance ok, …). */
  prepared: boolean;
};

/**
 * Per-build options passed uniformly to every adapter's `useClaimCalls`. Only the
 * stake adapter reads `restake` (SKY-only: fold the SKY reward back via `lock` +
 * conditional approve); merkl/sky ignore it.
 */
export type ClaimCallOptions = {
  restake?: boolean;
};

/**
 * A claim engine normalized to two hooks: read the rewards claimable in a scope,
 * and turn a selected subset into raw `Call[]`. The adapters are a FIXED trio the
 * panel calls unconditionally (rules-of-hooks) — not a runtime registry. The panel
 * merges every in-scope adapter's calls and runs ONE `useTransactionFlow`
 * (EIP-5792 batch; sequential fallback), so adapters expose CALLS rather than a
 * self-contained execute.
 */
export type ClaimAdapter = {
  source: ClaimSource;
  /** Reads the rewards claimable for `scope` (empty when this source has none in scope). */
  useClaimable: (scope: ClaimScope) => ClaimableResult;
  /** Builds the calldata for the `selected` subset belonging to THIS source. */
  useClaimCalls: (selected: ClaimableReward[], options?: ClaimCallOptions) => ClaimCallsResult;
};
