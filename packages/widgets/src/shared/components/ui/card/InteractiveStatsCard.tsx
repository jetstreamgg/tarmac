import { Card, CardContent, CardFooter } from '@widgets/components/ui/card';
import { Text } from '../Typography';
import { TokenIcon } from '../token/TokenIcon';
import { Link } from 'react-router-dom';

export const InteractiveStatsCard = ({
  title,
  headerRightContent,
  footer,
  footerRightContent,
  tokenSymbol,
  url,
  chainId
}: {
  title: React.ReactElement | string;
  headerRightContent: React.ReactElement | string;
  footer: React.ReactElement | string;
  footerRightContent?: React.ReactElement | string;
  tokenSymbol: string;
  url?: string;
  chainId?: number;
}): React.ReactElement => {
  return (
    <Card variant={url ? 'statsInteractive' : 'stats'} className="relative p-4 lg:p-5">
      <div className="flex items-center gap-2">
        <TokenIcon
          className="h-8 w-8"
          token={{ symbol: tokenSymbol, name: tokenSymbol }}
          chainId={chainId ?? 1}
        />{' '}
        <div className="grow">
          <CardContent className="flex items-center justify-between gap-4">
            <Text>{title}</Text>
            {headerRightContent}
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-start justify-between">
              <div className="flex-1">{footer}</div>
              {footerRightContent}
            </div>
          </CardFooter>
        </div>
      </div>
      {url && <Link to={url} className="absolute inset-0 z-0 h-full w-full rounded-[20px]" />}
    </Card>
  );
};
