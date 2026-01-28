import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@widgets/components/ui/accordion';
import { Text } from '../Typography';
import { FetchingSpinner } from '../spinner/FetchingSpinner';
import { AnimatePresence, motion } from 'framer-motion';
import { positionAnimations, positionAnimationsWithExit } from '@widgets/shared/animation/presets';
import { AnimationLabels } from '@widgets/shared/animation/constants';
import { PopoverRateInfo } from '../PopoverRateInfo';
import { HStack } from '../layout/HStack';
import { ArrowDown } from '../../icons/ArrowDown';
import { PopoverInfo } from '../PopoverInfo';
import React from 'react';

type TransactionOverviewParams = {
  title: string;
  isFetching: boolean;
  fetchingMessage: string;
  rateType?: 'str' | 'ssr' | 'srr' | 'dtc' | 'stusds' | 'morpho';
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  transactionData:
    | {
        label: string;
        value: string | string[] | React.ReactNode;
        error?: boolean;
        className?: string;
        classNamePrev?: string;
        tooltipTitle?: string;
        tooltipText?: string | React.ReactNode;
      }[]
    | undefined;
};

export function TransactionOverview({
  title,
  isFetching,
  fetchingMessage,
  rateType = 'ssr',
  onExternalLinkClicked,
  transactionData
}: TransactionOverviewParams) {
  return (
    <AnimatePresence mode="popLayout">
      {isFetching ? (
        <motion.div
          key="fetching"
          variants={positionAnimationsWithExit}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
          exit={AnimationLabels.exit}
        >
          <FetchingSpinner message={fetchingMessage} />
        </motion.div>
      ) : !transactionData ? null : (
        <motion.div
          key="fetched"
          variants={positionAnimations}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
        >
          <Accordion type="single" collapsible className="p-4" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="py-1">
                <Text variant="medium" className="font-medium">
                  {title}
                </Text>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {transactionData.map(
                  ({
                    label,
                    value,
                    tooltipTitle,
                    tooltipText,
                    error = false,
                    className = '',
                    classNamePrev
                  }) => (
                    <motion.div key={label} className="flex justify-between" variants={positionAnimations}>
                      <HStack className="items-center" gap={1}>
                        <Text
                          className={`text-${error ? 'error' : 'textSecondary'} flex items-center text-sm`}
                        >
                          {label}
                        </Text>
                        {(label === 'Rate' || label === 'stUSDS Rate') && rateType && (
                          <span className="mt-1">
                            <PopoverRateInfo
                              type={rateType}
                              onExternalLinkClicked={onExternalLinkClicked}
                              iconClassName="text-textSecondary"
                            />
                          </span>
                        )}
                        {tooltipText && (
                          <PopoverInfo
                            title={tooltipTitle || ''}
                            description={tooltipText}
                            iconClassName="text-textSecondary"
                          />
                        )}
                      </HStack>

                      {Array.isArray(value) && value.length >= 2 ? (
                        <HStack className="shrink-0 items-center" gap={2}>
                          <Text
                            className={`${error ? 'text-error' : classNamePrev || className} text-right text-sm`}
                          >
                            {value[0]}
                          </Text>
                          <ArrowDown className="-rotate-90" boxSize={12} />
                          <Text className={`${error ? 'text-error' : className} text-right text-sm`}>
                            {value[1]}
                          </Text>
                        </HStack>
                      ) : (
                        <Text className={`${error ? 'text-error' : className} text-right text-sm`}>
                          {value}
                        </Text>
                      )}
                    </motion.div>
                  )
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
