import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@widgets/components/ui/popover';
import { Close } from '../icons/Close';
import { Info } from '../icons/Info';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { ReactNode } from 'react';

export interface PopoverInfoProps {
  title: string;
  description: ReactNode;
  iconClassName?: string;
  width?: number;
  height?: number;
}

export const PopoverInfo = ({
  title,
  description,
  iconClassName,
  width = 16,
  height = 15
}: PopoverInfoProps) => {
  return (
    <Popover>
      <PopoverTrigger onClick={e => e.stopPropagation()} className="z-10">
        <Info className={iconClassName} width={width} height={height} />
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className="bg-containerDark w-80 rounded-xl backdrop-blur-[50px]"
      >
        <Heading variant="small" className="text-[16px] leading-6">
          {title}
        </Heading>
        <PopoverClose onClick={e => e.stopPropagation()} className="absolute right-4 top-4 z-10">
          <Close className="h-5 w-5 cursor-pointer text-white" />
        </PopoverClose>
        <div className="scrollbar-thin mt-2 max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto">
          {typeof description === 'string' ? (
            <Text variant="small" className="leading-5 text-white/80">
              {description}
            </Text>
          ) : (
            description
          )}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
};
