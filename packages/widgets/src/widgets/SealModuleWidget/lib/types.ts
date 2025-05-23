export type OnSealUrnChange = (
  urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
) => void;
