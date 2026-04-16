import { TokenIcon } from './TokenIcon';

export function PairTokenIcons({
  leftToken,
  rightToken,
  chainId,
  noChain
}: {
  leftToken: string;
  rightToken: string;
  chainId?: number;
  tokenSize?: number;
  noChain?: boolean;
}): React.ReactElement {
  return (
    <div className={'relative h-6 w-[44px]'}>
      <div className="absolute left-0 z-10">
        <TokenIcon token={{ symbol: leftToken }} chainId={chainId} noChain={noChain} className="h-6 w-6" />
      </div>
      <div className="absolute right-0 z-0">
        <TokenIcon token={{ symbol: rightToken }} chainId={chainId} noChain={noChain} className="h-6 w-6" />
      </div>
    </div>
  );
}
