import { Text } from '@widgets/shared/components/ui/Typography';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { cn } from '@widgets/lib/utils';

export const TextWithTooltip = ({
  text,
  tooltip,
  textClassName,
  gap = 2,
  iconClassName,
  contentClassname
}: {
  text: string;
  tooltip: string;
  textClassName?: string;
  gap?: number;
  iconClassName?: string;
  contentClassname?: string;
}) => {
  return (
    <HStack className="items-center" gap={gap}>
      <Text className={cn('text-textSecondary text-sm font-normal leading-tight', textClassName)}>
        {text}
      </Text>
      <InfoTooltip contentClassname={contentClassname} iconClassName={iconClassName} content={tooltip} />
    </HStack>
  );
};
