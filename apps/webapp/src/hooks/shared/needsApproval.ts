/**
 * Whether spending `amount` needs an approve first. False while the allowance is
 * still unknown: flows wait for the read rather than guess (APP-675). Engines and
 * step labels share it so the Approve steps always match the calls sent.
 */
export function needsApproval(allowance: bigint | undefined, amount: bigint): boolean {
  return allowance !== undefined && allowance < amount;
}
