import { Card } from '@widgets/components/ui/card';
import { Text } from '../Typography';
import { TokenIcon } from '../token/TokenIcon';
import { Link } from 'react-router-dom';
import { Logo, LogoName } from '../../ModuleLogo';

export const InteractiveStatsCardAlt = ({
  title,
  tokenSymbol,
  url,
  logoName,
  chainId,
  noChain,
  content
}: {
  title: React.ReactElement | string;
  tokenSymbol: string;
  url?: string;
  logoName: LogoName;
  chainId?: number;
  noChain?: boolean;
  content: React.ReactElement;
}): React.ReactElement => {
  return (
    <Card variant={url ? 'statsInteractive' : 'stats'} className="relative p-4 lg:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Text className="text-textSecondary text-sm leading-4">{title}</Text>
          <div className="flex items-center gap-2">
            <TokenIcon
              className="h-6 w-6"
              token={{ symbol: tokenSymbol, name: tokenSymbol }}
              chainId={chainId ?? 1}
              noChain={noChain}
            />
            {content}
          </div>
        </div>
        <Logo logoName={logoName} />
      </div>
      {url && <Link to={url} className="absolute inset-0 z-0 h-full w-full rounded-[20px]" />}
    </Card>
  );
};
