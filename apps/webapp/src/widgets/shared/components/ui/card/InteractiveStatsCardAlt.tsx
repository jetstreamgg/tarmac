import { Trans } from '@lingui/react/macro';
import { Card } from '@/widgets/components/ui/card';
import { Text } from '../Typography';
import { TokenIcon } from '../token/TokenIcon';
import { AppLink } from '@/lib/navigation';
import { Logo, LogoName } from '../../ModuleLogo';

export const InteractiveStatsCardAlt = ({
  title,
  tokenSymbol,
  url,
  logoName,
  chainId,
  noChain,
  content,
  icon,
  apyBadge
}: {
  title: React.ReactElement | string;
  tokenSymbol?: string;
  url?: string;
  logoName: LogoName;
  chainId?: number;
  noChain?: boolean;
  content: React.ReactElement;
  icon?: React.ReactNode;
  apyBadge?: string;
}): React.ReactElement => {
  return (
    <Card variant={url ? 'statsInteractive' : 'stats'} className="group/asset-row relative p-4 lg:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Text className="text-textSecondary text-sm leading-4">{title}</Text>
            {apyBadge && (
              <span
                data-testid="asset-apy-badge"
                className="rounded-full border border-[#1DD9BA]/40 px-2 py-0.5 text-xs leading-4 text-[#1DD9BA]"
              >
                {apyBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {icon ? (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">{icon}</div>
            ) : tokenSymbol ? (
              <TokenIcon
                className="h-6 w-6"
                token={{ symbol: tokenSymbol, name: tokenSymbol }}
                chainId={chainId ?? 1}
                noChain={noChain}
              />
            ) : null}
            {content}
          </div>
        </div>
        <Logo logoName={logoName} />
      </div>
      {url && (
        <>
          <AppLink
            to={url}
            aria-label={typeof title === 'string' ? title : 'Open details'}
            className="absolute inset-0 z-0 h-full w-full rounded-[20px]"
          />
          <AppLink
            to={url}
            data-testid="start-earning-cta"
            className="absolute right-4 bottom-4 z-10 rounded-full bg-[#6161FF] px-3 py-1 text-xs leading-4 text-[#1C1655] opacity-0 transition-opacity group-hover/asset-row:opacity-100 focus-visible:opacity-100"
          >
            <Trans>Get started</Trans>
          </AppLink>
        </>
      )}
    </Card>
  );
};
