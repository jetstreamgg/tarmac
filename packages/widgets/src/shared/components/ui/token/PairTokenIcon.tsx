import { TokenIcon } from './TokenIcon';

export function PairTokenIcons({
  leftToken,
  rightToken,
  chainId
}: {
  leftToken: string;
  rightToken: string;
  chainId?: number;
  tokenSize?: number;
}): React.ReactElement {
  return (
    <div className={'relative h-6 w-[44px]'}>
      <div className="absolute left-0 z-10">
        <TokenIcon token={{ symbol: leftToken }} chainId={chainId} className="h-6 w-6" />
      </div>
      <div className="absolute right-0 z-0">
        <TokenIcon token={{ symbol: rightToken }} chainId={chainId} className="h-6 w-6" />
      </div>
    </div>
  );
}
