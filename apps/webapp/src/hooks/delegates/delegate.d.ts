export type DelegateRaw = {
  id: `0x${string}`;
  blockTimestamp: string;
  metadata: {
    id: string;
    name: string;
    description: string;
    image: string;
    externalProfileURL: string;
  };
  ownerAddress: `0x${string}`;
  totalDelegated: string;
  delegators: number;
  delegations: {
    id: `0x${string}`;
    delegator: `0x${string}`;
    amount: string;
    timestamp: string;
  }[];
};

export type DelegateInfo = Omit<DelegateRaw, 'delegations'> & {
  totalDelegated: bigint;
  delegations: {
    id: `0x${string}`;
    delegator: `0x${string}`;
    amount: bigint;
    timestamp: string;
  }[];
};
