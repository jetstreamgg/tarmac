import { positionAnimations } from '@widgets/shared/animation/presets';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { motion } from 'framer-motion';
import { Text } from '@widgets/shared/components/ui/Typography';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { ArrowDown } from '@widgets/shared/components/icons/ArrowDown';
import { JSX } from 'react';
import { cn } from '@widgets/lib/utils';

export const LineItem = ({
  label,
  value,
  icon,
  className,
  tooltipText,
  labelAlignment = 'horizontal',
  containerClassName
}: {
  label: string;
  value?: string | (string | undefined)[] | string[];
  icon?: JSX.Element | JSX.Element[];
  className?: string | string[];
  containerClassName?: string;
  tooltipText?: string;
  labelAlignment?: 'vertical' | 'horizontal';
}) => {
  return (
    <motion.div
      key={label}
      className={cn(
        `flex ${labelAlignment === 'vertical' ? 'flex-col space-y-2' : 'justify-between'} py-2`,
        containerClassName
      )}
      variants={positionAnimations}
    >
      <HStack className="items-center" gap={1}>
        <Text className={'text-textSecondary flex items-center text-sm'}>
          {label}
          {label === 'Rate' && (
            <span className="ml-2 mt-1">
              <PopoverRateInfo type="ssr" />
            </span>
          )}
        </Text>
        {tooltipText && <InfoTooltip content={tooltipText} iconClassName="text-textSecondary" />}
      </HStack>
      {Array.isArray(value) && value.length >= 2 ? (
        <HStack className="shrink-0 items-center">
          <div className="flex items-center gap-2">
            {Array.isArray(icon) ? icon[0] : icon}
            <Text
              className={cn(
                Array.isArray(className) && className.length >= 2 ? className[0] : className,
                'text-right text-sm'
              )}
            >
              {value[0]}
            </Text>
          </div>
          {value[0] && <ArrowDown className="-rotate-90" boxSize={12} />}
          <div className="flex items-center gap-2">
            {Array.isArray(icon) && icon.length === 2 && icon[1]}
            <Text
              className={`${
                Array.isArray(className) && className.length >= 2 ? className[1] : className
              } text-right text-sm`}
            >
              {value[1]}
            </Text>
          </div>
        </HStack>
      ) : (
        <div className="flex items-center gap-2">
          {icon}
          <Text className={cn(className, 'text-right text-sm')}>{value}</Text>
        </div>
      )}
    </motion.div>
  );
};
