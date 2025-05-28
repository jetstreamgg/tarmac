import { SettingsIcon } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { VStack } from './VStack';
import { Heading } from './Typography';
import { HStack } from './HStack';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { BATCH_TX_KEY } from '@/lib/constants';

export const HeaderMenu = (): React.ReactElement => {
  // we can't use a Button inside PopoverTrigger because PopoverTrigger is already a button
  // this applies all the button styles to a div inside the PopoverTrigger
  const paginationButtonClasses =
    'flex justify-center text-textDesaturated text-base leading-normal bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 rounded-full hover:from-primary-start/40 hover:to-primary-end/40 hover:text-text active:text-text active:from-primary-start/20 active:to-primary-end/20 data-[state=open]:from-primary-start/80 data-[state=open]:to-primary-end/80 data-[state=open]:text-text h-min p-1.5 transition duration-250 ease-out-expo';

  const [batchEnabled, setBatchEnabled] = useState<boolean>(
    window.localStorage.getItem(BATCH_TX_KEY) === 'true'
  );

  const handleCheckedChange = (checked: boolean) => {
    setBatchEnabled(checked);
    window.localStorage.setItem(BATCH_TX_KEY, checked.toString());
  };

  return (
    <Popover>
      <PopoverTrigger className={paginationButtonClasses}>
        <SettingsIcon width={20} />
      </PopoverTrigger>
      <PopoverContent className="bg-container w-[330px] rounded-[20px] border-0 backdrop-blur-[50px]">
        <VStack className="w-full gap-5">
          <HStack className="items-center justify-between">
            <Heading variant="small">
              <Trans>Batch transactions</Trans>
            </Heading>
            <Switch checked={batchEnabled} onCheckedChange={handleCheckedChange} />
          </HStack>
        </VStack>
        <PopoverArrow className="fill-container" />
      </PopoverContent>
    </Popover>
  );
};
