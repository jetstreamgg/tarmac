import { Dispatch, SetStateAction, useContext } from 'react';
import {
  ercFlowSlippageConfig,
  SlippageType,
  TradeFlow,
  TradeScreen,
  ethFlowSlippageConfig,
  ETH_SLIPPAGE_STORAGE_KEY,
  ERC_SLIPPAGE_STORAGE_KEY
} from '../lib/constants';
import { Settings as SettingsIcon } from '@widgets/shared/components/icons/Icons';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { verifySlippage } from '../lib/utils';
import { getTooltipById } from '@widgets/data/tooltips';
import { parseMarkdownLinks } from '@widgets/shared/utils/parseMarkdownLinks';

type PropTypes = {
  slippage: string;
  setSlippage: (newSlippage: string) => void;
  isEthFlow?: boolean;
  ttl: string;
  setTtl: Dispatch<SetStateAction<string>>;
};

export const TradeConfigMenu = ({
  slippage,
  setSlippage,
  isEthFlow
}: PropTypes): React.ReactElement | null => {
  const { widgetState } = useContext(WidgetContext);
  const slippageConfig = isEthFlow ? ethFlowSlippageConfig : ercFlowSlippageConfig;
  const SLIPPAGE_STORAGE_KEY = isEthFlow ? ETH_SLIPPAGE_STORAGE_KEY : ERC_SLIPPAGE_STORAGE_KEY;

  const handleSlippageChange = (value: string) => {
    // Parse value and apply precision figures
    const splitValue = value.split('.');
    const parsedValue =
      splitValue.length === 1 ? splitValue[0] : [splitValue[0], splitValue[1].slice(0, 2)].join('.');
    const verifiedSlippage = verifySlippage(parsedValue, slippageConfig);

    setSlippage(verifiedSlippage);
    window.localStorage.setItem(SLIPPAGE_STORAGE_KEY, verifiedSlippage);
  };

  // we can't use a Button inside PopoverTrigger because PopoverTrigger is already a button
  // this applies all the button styles to a div inside the PopoverTrigger
  const paginationButtonClasses =
    'flex justify-center text-textDesaturated text-base leading-normal bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 rounded-full hover:from-primary-start/40 hover:to-primary-end/40 hover:text-text active:text-text active:from-primary-start/20 active:to-primary-end/20 data-[state=open]:from-primary-start/80 data-[state=open]:to-primary-end/80 data-[state=open]:text-text h-min p-1.5 transition-[background-color,background-image,opacity,color] duration-250 ease-out-expo';

  return widgetState.flow === TradeFlow.TRADE && widgetState.screen === TradeScreen.ACTION ? (
    <Popover>
      <PopoverTrigger className={paginationButtonClasses}>
        <SettingsIcon width={20} />
      </PopoverTrigger>
      <PopoverContent className="bg-container w-[330px] rounded-[20px] border-0 backdrop-blur-[50px]">
        <VStack className="w-full gap-5">
          <div className="space-y-3">
            <Heading variant="small">
              <Trans>Slippage</Trans>
            </Heading>
            <Text variant="medium" className="text-textSecondary">
              {parseMarkdownLinks(getTooltipById('slippage-tolerance')?.tooltip || '')}
            </Text>
          </div>
          <HStack className="w-full justify-between">
            <Tabs
              className="w-full"
              defaultValue={slippage ? SlippageType.CUSTOM : SlippageType.AUTO}
              onValueChange={value => {
                const newSlippageValue = value === SlippageType.AUTO ? '' : slippageConfig.default.toString();
                handleSlippageChange(newSlippageValue);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  className="border-selectActive rounded-xl rounded-r-none border-r-0"
                  value="auto"
                >
                  Auto
                </TabsTrigger>
                <TabsTrigger
                  className="border-selectActive rounded-xl rounded-l-none border-l-0"
                  value="custom"
                >
                  Custom
                </TabsTrigger>
              </TabsList>
              <TabsContent value="auto">
                <div className="flex h-[60px] w-full items-center justify-between p-2">
                  <Text className="text-text">Max slippage:</Text>
                  <Text className="text-text ml-2">{slippageConfig.default}%</Text>
                </div>
              </TabsContent>
              <TabsContent value="custom">
                <HStack className="h-[60px] items-center justify-between space-x-1 rounded-xl p-2">
                  <Text className="text-text">Max slippage:</Text>
                  <HStack className="border-selectActive flex items-center rounded-xl border p-2">
                    <input
                      placeholder={t`Custom`}
                      className="bg-background ring-offset-background placeholder:text-surface text-text focus-visible:outline-hidden w-[55px] text-right text-[14px] leading-tight [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      type="number"
                      min={slippageConfig.min}
                      max={slippageConfig.max}
                      value={slippage}
                      onChange={e => handleSlippageChange(e.target.value)}
                    />
                    <Text variant="small" className="text-text mt-[3px]">
                      %
                    </Text>
                  </HStack>
                </HStack>
              </TabsContent>
            </Tabs>
          </HStack>
        </VStack>
        <PopoverArrow className="fill-container" />
      </PopoverContent>
    </Popover>
  ) : null;
};
