import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Trans } from '@lingui/react/macro';

type MockStatsCardProps = {
  name: string;
  tokenSymbol: string;
  badge?: React.ReactNode;
  rate: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
  onClick?: () => void;
  disabled?: boolean;
};

export const MockStatsCard = ({
  name,
  tokenSymbol,
  badge,
  rate,
  stat1Label,
  stat1Value,
  stat2Label,
  stat2Value,
  onClick,
  disabled = false
}: MockStatsCardProps) => {
  return (
    <Card
      className={`from-card to-card h-full bg-radial-(--gradient-position) transition-[background-color,background-image,opacity] lg:p-5 ${onClick && !disabled ? 'hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer' : ''} ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: tokenSymbol }} />
          <Text>{name}</Text>
          {badge}
        </HStack>
        <HStack className="items-center" gap={2}>
          <Text tag="span" className="text-bullish">
            {rate}
          </Text>
        </HStack>
      </CardHeader>
      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          <VStack className="items-stretch justify-between" gap={2}>
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>{stat1Label}</Trans>
            </Text>
            <Text>{stat1Value}</Text>
          </VStack>
          <VStack className="items-stretch justify-between text-right" gap={2}>
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>{stat2Label}</Trans>
            </Text>
            <Text>{stat2Value}</Text>
          </VStack>
        </HStack>
      </CardContent>
    </Card>
  );
};
