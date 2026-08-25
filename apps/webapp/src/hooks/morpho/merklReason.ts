/**
 * Merkl attributes a campaign to a Morpho vault by embedding the vault address
 * in the breakdown `reason` string. This is the single place that convention
 * is encoded — the rewards claim panel (useMerklRewards) and the APP-450
 * earnings attribution (computeMerklEarnings) both match through it, so they
 * can never drift apart on what "belongs to a vault" means. Named campaigns
 * without an address (airdrops) are an earnings-side concern layered on top.
 */
export const reasonContainsVaultAddress = (reason: string, vaultAddress: string): boolean =>
  reason.toLowerCase().includes(vaultAddress.toLowerCase());
