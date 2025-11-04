import { AlertCircle } from 'lucide-react';
import { HStack } from './layout/HStack';
import { Text } from './Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { cn } from '@widgets/lib/utils';
import { PopoverInfo } from './PopoverInfo';
import { ReactNode } from 'react';

export interface UtilizationBarProps {
  utilizationRate: number;
  isLoading?: boolean;
  showAlert?: boolean;
  showLabel?: boolean;
  label?: string;
  className?: string;
  barHeight?: string;
  dataTestId?: string;
  popoverTitle?: string;
  popoverDescription?: ReactNode;
}

export const UtilizationBar = ({
  utilizationRate,
  isLoading = false,
  showAlert = true,
  showLabel = true,
  label,
  className,
  barHeight = 'h-[5px]',
  dataTestId = 'utilization-bar',
  popoverTitle,
  popoverDescription
}: UtilizationBarProps) => {
  const isHighUtilization = utilizationRate > 90;
  // const utilizationColor =
  //   utilizationRate > 90 ? 'text-error' : utilizationRate > 75 ? 'text-orange-400' : 'text-textSecondary';
  const utilizationColor = 'text-textSecondary';

  // const barColor =
  //   utilizationRate > 90 ? 'bg-error' : utilizationRate > 75 ? 'bg-orange-400' : 'bg-textSecondary';
  const barColor = 'bg-textSecondary';

  return (
    <div className={cn('w-full', className)} data-testid={dataTestId}>
      {showLabel && (
        <HStack className="mb-2 justify-between">
          <HStack gap={1} className="items-center">
            {label && <Text className="text-textSecondary text-sm leading-4">{label}</Text>}
            {popoverTitle && popoverDescription && (
              <PopoverInfo
                title={popoverTitle}
                description={popoverDescription}
                iconClassName="text-textSecondary hover:text-white transition-colors"
                iconSize="medium"
              />
            )}
          </HStack>
          {isLoading ? (
            <Skeleton className="bg-textSecondary h-6 w-10" />
          ) : (
            <HStack className="items-center" gap={1}>
              <Text className={utilizationColor} dataTestId={`${dataTestId}-percentage`}>
                {utilizationRate.toFixed(1)}%
              </Text>
              {showAlert && isHighUtilization && <AlertCircle className="text-error h-4 w-4" />}
            </HStack>
          )}
        </HStack>
      )}
      <div className={cn('bg-secondary overflow-hidden rounded-full', barHeight)}>
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(utilizationRate, 100)}%` }}
        />
      </div>
    </div>
  );
};
