import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading } from '@/modules/layout/components/Typography';
import { GradientShapeCard } from './GradientShapeCard';
import { TokenIcon } from './TokenIcon';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

type AboutCardProps = {
  title?: ReactNode;
  tokenSymbol?: string;
  icon?: ReactNode;
  description: ReactNode;
  linkHref?: string;
  linkLabel?: ReactNode;
  colorMiddle: string;
  height?: number | undefined;
  contentWidth?: 'w-2/3' | 'w-1/2';
};

export const AboutCard = ({
  title,
  tokenSymbol,
  icon,
  description,
  linkHref,
  linkLabel = <Trans>View contract</Trans>,
  colorMiddle,
  height,
  contentWidth = 'w-2/3'
}: AboutCardProps) => {
  const { userConfig } = useConfigContext();
  // The card gradients are inline styles, so they can't use the CSS `light:`
  // variant — pick a lighter periwinkle base in light mode here instead. The
  // per-card `colorMiddle` accent stripe stays as-is in both themes.
  const isLight = userConfig.theme === 'light';
  const colorLeft = isLight
    ? 'radial-gradient(200.08% 406.67% at 5.14% 108.47%, #8E7DF0 0%, #B7ABF1 21.68%)'
    : 'radial-gradient(200.08% 406.67% at 5.14% 108.47%, #4331E9 0%, #2A197D 21.68%)';
  const colorRight = isLight ? '#D6D0F2' : '#1e1a4b';

  const renderTitle = () => {
    if (icon && title) {
      return (
        <>
          {icon}
          {title}
        </>
      );
    }

    if (title && tokenSymbol) {
      return (
        <>
          <TokenIcon token={{ symbol: tokenSymbol }} width={24} className="h-6 w-6" showChainIcon={false} />
          {title}
        </>
      );
    }

    if (tokenSymbol) {
      return (
        <>
          <TokenIcon token={{ symbol: tokenSymbol }} width={24} className="h-6 w-6" showChainIcon={false} />
          <Trans>{tokenSymbol}</Trans>
        </>
      );
    }

    if (title) {
      return title;
    }

    return null;
  };

  const titleContent = renderTitle();

  return (
    <GradientShapeCard
      colorLeft={colorLeft}
      colorMiddle={colorMiddle}
      colorRight={colorRight}
      className="mb-6"
      height={height}
    >
      <div className={cn('w-[80%] space-y-2 self-start', contentWidth === 'w-1/2' ? 'xl:w-1/2' : 'xl:w-2/3')}>
        {titleContent && <Heading className="flex items-center gap-2">{titleContent}</Heading>}
        <div className="font-graphik text-[13px] leading-normal font-normal">{description}</div>
      </div>
      {linkHref && (
        <ExternalLink href={linkHref} showIcon={false} className="mt-auto w-fit pt-3 xl:self-end xl:pt-0">
          <Button variant="outline" className="border-border gap-2">
            {linkLabel}
            <ExternalLinkIcon size={16} />
          </Button>
        </ExternalLink>
      )}
    </GradientShapeCard>
  );
};
