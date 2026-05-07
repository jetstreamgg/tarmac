import { useEffect, useRef, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Settings as SettingsIcon } from '@widgets/shared/components/icons/Icons';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { pendleSlippageConfig, PendleSlippageType } from '../lib/constants';
import {
  decimalSlippageToPercentString,
  percentStringToDecimalSlippage,
  verifyPendleSlippage
} from '../lib/utils';

type PendleConfigMenuProps = {
  /** User's current slippage as a decimal (e.g. 0.002 for 0.2%) */
  slippage: number;
  /** Default slippage for the active flow as a decimal */
  defaultSlippage: number;
  setSlippage: (decimal: number) => void;
};

const paginationButtonClasses =
  'flex justify-center text-textDesaturated text-base leading-normal bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 rounded-full hover:from-primary-start/40 hover:to-primary-end/40 hover:text-text active:text-text active:from-primary-start/20 active:to-primary-end/20 data-[state=open]:from-primary-start/80 data-[state=open]:to-primary-end/80 data-[state=open]:text-text h-min p-1.5 transition-[background-color,background-image,opacity,color] duration-250 ease-out-expo';

export const PendleConfigMenu = ({ slippage, defaultSlippage, setSlippage }: PendleConfigMenuProps) => {
  // Local raw string state for the input. Storing the user's keystrokes as a
  // string (rather than reformatting from `slippage: number` on every render)
  // is what lets them type "0.5" — without this, the "." gets eaten because
  // `Number("0.") === 0` round-trips back to "0" in the display.
  const [rawInput, setRawInput] = useState<string>(() =>
    slippage !== defaultSlippage ? decimalSlippageToPercentString(slippage) : ''
  );

  // Mirror rawInput into a ref so the effect below can read its latest value
  // without listing it as a dependency (which would re-fire on every keystroke
  // and clobber in-progress edits).
  const rawInputRef = useRef(rawInput);
  rawInputRef.current = rawInput;

  // Re-sync the input when slippage is updated from outside the menu
  // (e.g. flow change resets default; Auto tab click sets to default).
  useEffect(() => {
    if (slippage === defaultSlippage) {
      setRawInput('');
      return;
    }
    // Only overwrite the input if the user's current text doesn't already
    // map to the same numeric value — otherwise we'd clobber an in-progress
    // edit (e.g. user mid-typing "0." while slippage emits the same number).
    const currentNumeric = percentStringToDecimalSlippage(rawInputRef.current);
    if (Math.abs(currentNumeric - slippage) > 1e-9) {
      setRawInput(decimalSlippageToPercentString(slippage));
    }
  }, [slippage, defaultSlippage]);

  const isCustom = slippage !== defaultSlippage;

  const handleCustomChange = (value: string) => {
    const verified = verifyPendleSlippage(value, pendleSlippageConfig);
    setRawInput(verified);
    if (verified === '') {
      setSlippage(0);
      return;
    }
    setSlippage(percentStringToDecimalSlippage(verified));
  };

  return (
    <Popover>
      <PopoverTrigger className={paginationButtonClasses} aria-label={t`Open slippage settings`}>
        <SettingsIcon width={20} />
      </PopoverTrigger>
      <PopoverContent className="bg-container w-[330px] rounded-[20px] border-0 backdrop-blur-[50px]">
        <VStack className="w-full gap-5">
          <div className="space-y-3">
            <Heading variant="small">
              <Trans>Slippage</Trans>
            </Heading>
            <Text variant="medium" className="text-textSecondary">
              <Trans>
                Maximum acceptable difference between the quoted PT amount and what the trade actually
                executes at. Higher tolerance means a higher chance of fill but a worse price.
              </Trans>
            </Text>
          </div>
          <HStack className="w-full justify-between">
            <Tabs
              className="w-full"
              defaultValue={isCustom ? PendleSlippageType.CUSTOM : PendleSlippageType.AUTO}
              onValueChange={value => {
                if (value === PendleSlippageType.AUTO) {
                  setSlippage(defaultSlippage);
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  className="border-selectActive rounded-xl rounded-r-none border-r-0"
                  value={PendleSlippageType.AUTO}
                >
                  <Trans>Auto</Trans>
                </TabsTrigger>
                <TabsTrigger
                  className="border-selectActive rounded-xl rounded-l-none border-l-0"
                  value={PendleSlippageType.CUSTOM}
                >
                  <Trans>Custom</Trans>
                </TabsTrigger>
              </TabsList>
              <TabsContent value={PendleSlippageType.AUTO}>
                <div className="flex h-[60px] w-full items-center justify-between p-2">
                  <Text className="text-text">
                    <Trans>Max slippage:</Trans>
                  </Text>
                  <Text className="text-text ml-2">{decimalSlippageToPercentString(defaultSlippage)}%</Text>
                </div>
              </TabsContent>
              <TabsContent value={PendleSlippageType.CUSTOM}>
                <HStack className="h-[60px] items-center justify-between space-x-1 rounded-xl p-2">
                  <Text className="text-text">
                    <Trans>Max slippage:</Trans>
                  </Text>
                  <HStack className="border-selectActive flex items-center rounded-xl border p-2">
                    <input
                      placeholder={t`Custom`}
                      className="bg-background ring-offset-background placeholder:text-surface text-text w-[55px] [appearance:textfield] text-right text-[14px] leading-tight focus-visible:outline-hidden [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      type="number"
                      step="any"
                      min={pendleSlippageConfig.min}
                      max={pendleSlippageConfig.max}
                      inputMode="decimal"
                      value={rawInput}
                      onChange={e => handleCustomChange(e.target.value)}
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
  );
};
