export function absBigInt(bigint: bigint) {
  if (bigint < 0n) return -bigint;
  else return bigint;
}
