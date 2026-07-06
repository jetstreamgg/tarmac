import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/widgets/components/ui/accordion';
import { Text } from '../Typography';
import { FetchingSpinner } from '../spinner/FetchingSpinner';
import { AnimatePresence, motion } from 'motion/react';
import { positionAnimations, positionAnimationsWithExit } from '@/widgets/shared/animation/presets';
import { AnimationLabels } from '@/widgets/shared/animation/constants';
import { PopoverRateInfo } from '../PopoverRateInfo';
import { HStack } from '../layout/HStack';
import { ArrowDown } from '../../icons/ArrowDown';
import { PopoverInfo } from '../PopoverInfo';
import { cn } from '@/widgets/lib/utils';
import React from 'react';

type TransactionDataRow = {
  label: string;
  value: string | string[] | React.ReactNode;
  error?: boolean;
  className?: string;
  classNamePrev?: string;
  labelClassName?: string;
  containerClassName?: string;
  tooltipTitle?: string;
  tooltipText?: string | React.ReactNode;
};

type TransactionOverviewParams = {
  title: string;
  isFetching: boolean;
  fetchingMessage: string;
  rateType?: 'str' | 'ssr' | 'srr' | 'dtc' | 'stusds' | 'morpho' | 'sky';
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  /**
   * Headline rows. When provided, renders as a TWO-accordion layout:
   *   - Section 1 ("title") — these rows, expanded by default
   *   - Section 2 ("detailsTitle") — `transactionData`, collapsed by default
   * When omitted, the legacy single-accordion shell renders `transactionData`
   * expanded by default. Per APP-268.
   */
  pinnedData?: TransactionDataRow[];
  /** Title for the second (details) section when `pinnedData` is provided. */
  detailsTitle?: string;
  transactionData: TransactionDataRow[] | undefined;
};

function OverviewRow({
  row,
  rateType,
  onExternalLinkClicked
}: {
  row: TransactionDataRow;
  rateType?: TransactionOverviewParams['rateType'];
  onExternalLinkClicked?: TransactionOverviewParams['onExternalLinkClicked'];
}) {
  const {
    label,
    value,
    tooltipTitle,
    tooltipText,
    error = false,
    className = '',
    classNamePrev,
    labelClassName,
    containerClassName
  } = row;
  return (
    <motion.div className={cn('flex justify-between', containerClassName)} variants={positionAnimations}>
      <HStack className="items-center" gap={1}>
        <Text
          className={cn(
            'flex items-center text-sm',
            error ? 'text-error' : 'text-textSecondary',
            labelClassName
          )}
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
          <Text className={`${error ? 'text-error' : classNamePrev || className} text-right text-sm`}>
            {value[0]}
          </Text>
          <ArrowDown className="-rotate-90" boxSize={12} />
          <Text className={`${error ? 'text-error' : className} text-right text-sm`}>{value[1]}</Text>
        </HStack>
      ) : (
        <Text className={`${error ? 'text-error' : className} text-right text-sm`}>{value}</Text>
      )}
    </motion.div>
  );
}

export function TransactionOverview({
  title,
  isFetching,
  fetchingMessage,
  rateType = 'ssr',
  onExternalLinkClicked,
  pinnedData,
  detailsTitle = 'Transaction details',
  transactionData
}: TransactionOverviewParams) {
  const hasPinned = !!pinnedData && pinnedData.length > 0;

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
      ) : !transactionData ? null : hasPinned ? (
        <motion.div
          key="fetched"
          variants={positionAnimations}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
        >
          {/* Two-accordion layout per APP-268: headline rows in section 1,
              technical rows in section 2 (collapsed by default). */}
          <div className="p-4">
            <Accordion type="single" collapsible defaultValue="overview" className="mb-2">
              <AccordionItem value="overview">
                <AccordionTrigger className="py-1">
                  <Text variant="medium" className="font-medium">
                    {title}
                  </Text>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {pinnedData!.map(row => (
                    <OverviewRow
                      key={row.label}
                      row={row}
                      rateType={rateType}
                      onExternalLinkClicked={onExternalLinkClicked}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Accordion type="single" collapsible>
              <AccordionItem value="details">
                <AccordionTrigger className="py-1">
                  <Text variant="medium" className="font-medium">
                    {detailsTitle}
                  </Text>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {transactionData.map(row => (
                    <OverviewRow
                      key={row.label}
                      row={row}
                      rateType={rateType}
                      onExternalLinkClicked={onExternalLinkClicked}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="fetched"
          variants={positionAnimations}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
        >
          {/* Legacy single-accordion shell for callers without pinnedData. */}
          <Accordion type="single" collapsible className="p-4" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="py-1">
                <Text variant="medium" className="font-medium">
                  {title}
                </Text>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {transactionData.map(row => (
                  <OverviewRow
                    key={row.label}
                    row={row}
                    rateType={rateType}
                    onExternalLinkClicked={onExternalLinkClicked}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
