import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { GradientShapeCard } from './GradientShapeCard';
import { TokenIcon } from './TokenIcon';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AboutCardProps {
  title?: ReactNode;
  tokenSymbol?: string;
  description: ReactNode;
  linkHref: string;
  linkLabel?: ReactNode;
  colorMiddle: string;
  height?: number | undefined;
  contentWidth?: 'w-2/3' | 'w-1/2';
}

export const AboutCard = ({
  title,
  tokenSymbol,
  description,
  linkHref,
  linkLabel = <Trans>View contract</Trans>,
  colorMiddle,
  height,
  contentWidth = 'w-2/3'
}: AboutCardProps) => {
  const renderTitle = () => {
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
      colorLeft="radial-gradient(200.08% 406.67% at 5.14% 108.47%, #4331E9 0%, #2A197D 21.68%)"
      colorMiddle={colorMiddle}
      colorRight="#1e1a4b"
      className="mb-6"
      height={height}
    >
      <div className={cn('w-[80%] space-y-2 self-start', contentWidth === 'w-1/2' ? 'xl:w-1/2' : 'xl:w-2/3')}>
        {titleContent && <Heading className="flex items-center gap-2">{titleContent}</Heading>}
        <Text variant="small">{description}</Text>
      </div>
      <ExternalLink href={linkHref} showIcon={false} className="mt-auto w-fit pt-3 xl:self-end xl:pt-0">
        <Button variant="outline" className="border-border gap-2">
          {linkLabel}
          <ExternalLinkIcon size={16} />
        </Button>
      </ExternalLink>
    </GradientShapeCard>
  );
};
