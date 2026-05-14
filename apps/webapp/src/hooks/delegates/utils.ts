import { DelegateInfo, DelegateRaw } from './delegate';

export function parseDelegatesFn(delegate: DelegateRaw) {
  return {
    ...delegate,
    totalDelegated: BigInt(delegate.totalDelegated),
    delegations: delegate.delegations?.map(
      delegation =>
        ({
          ...delegation,
          amount: BigInt(delegation.amount)
        }) as any
    )
  } as DelegateInfo;
}
