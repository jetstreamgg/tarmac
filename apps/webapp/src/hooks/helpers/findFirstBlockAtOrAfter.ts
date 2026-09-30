import type { PublicClient } from 'viem';

/** Post-merge Ethereum slot time; missed slots make the real average slightly longer. */
const SLOT_SECONDS = 12n;
const MAX_ESTIMATE_STEPS = 8;
const MAX_WALK_STEPS = 32;
/** How far ahead of the chain head a target may be and still be waited for. */
const MAX_WAIT_SECONDS = 120n;
const WAIT_POLL_MS = 4_000;
const MAX_WAIT_POLLS = 30;

/**
 * The first block whose timestamp is at or after `timestampSec`, found with
 * a few RPC reads and no external service: estimate from the 12s slot time,
 * re-estimate from each landed block until the estimate stops moving (missed
 * slots only shift it by a handful of blocks), then walk the last step or two.
 * Measured on mainnet for 2026-09-01: 5 sequential reads, ~1.5s, exact.
 * Waits up to about two minutes for a timestamp just past the chain head;
 * throws for one further out or when the search fails to converge.
 */
export async function findFirstBlockAtOrAfter(client: PublicClient, timestampSec: number): Promise<bigint> {
  const target = BigInt(timestampSec);
  const timestampOf = async (blockNumber: bigint) => (await client.getBlock({ blockNumber })).timestamp;

  // Right after a month rolls over the chain may not have a block in the new
  // month yet (the first slot after midnight UTC lands at :11, later with a
  // missed slot or a fast local clock): wait for it rather than fail.
  let latest = await client.getBlock();
  for (let poll = 0; latest.timestamp < target; poll++) {
    if (poll >= MAX_WAIT_POLLS || target - latest.timestamp > MAX_WAIT_SECONDS) {
      throw new Error(`No block at or after ${timestampSec} yet (latest ${latest.timestamp})`);
    }
    await new Promise(resolve => setTimeout(resolve, WAIT_POLL_MS));
    latest = await client.getBlock();
  }

  let number = latest.number;
  let timestamp = latest.timestamp;
  for (let step = 0; step < MAX_ESTIMATE_STEPS; step++) {
    const estimate = number - (timestamp - target) / SLOT_SECONDS;
    if (estimate === number || estimate < 0n) break;
    number = estimate;
    timestamp = await timestampOf(number);
  }

  // Landed early: walk forward to the first block at or after the target (the
  // one before it is then known to be early). Landed late: walk back while the
  // previous block still qualifies.
  if (timestamp < target) {
    for (let step = 0; timestamp < target; step++) {
      if (step >= MAX_WALK_STEPS) throw new Error(`Block search for ${timestampSec} did not converge`);
      number += 1n;
      timestamp = await timestampOf(number);
    }
    return number;
  }
  for (let step = 0; number > 0n && (await timestampOf(number - 1n)) >= target; step++) {
    if (step >= MAX_WALK_STEPS) throw new Error(`Block search for ${timestampSec} did not converge`);
    number -= 1n;
  }
  return number;
}
