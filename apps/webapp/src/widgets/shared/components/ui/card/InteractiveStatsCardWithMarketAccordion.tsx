import { Card, CardContent, CardFooter } from '@/widgets/components/ui/card';
import { Text } from '../Typography';
import { TokenIcon } from '../token/TokenIcon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/widgets/components/ui/accordion';
import { HStack } from '@/widgets/shared/components/ui/layout/HStack';
import { ArrowRight } from 'lucide-react';
import { formatBigInt, formatNumber } from '@/utils';
import { Link } from 'react-router-dom';
import { InteractiveStatsCard } from './InteractiveStatsCard';

export type MarketBalanceForAccordion = {
  marketName: string;
  marketAddress: `0x${string}`;
  balance: bigint;
  /** Balance normalized to 18 decimals for cross-asset comparison */
  balanceNormalized: bigint;
  /** Symbol used to resolve the row's token icon (e.g. "PT-sUSDS") */
  tokenIconSymbol: string;
  /** Decimals of the `balance` field for display formatting */
  balanceDecimals: number;
  valuationUsd: number;
  /** Implied APY as a decimal (e.g. 0.0725 for 7.25%). Omitted for matured markets. */
  rate?: number;
  isMatured: boolean;
};

export const InteractiveStatsCardWithMarketAccordion = ({
  title,
  headerRightContent,
  footer,
  footerRightContent,
  marketBalances,
  urlMap,
  icon,
  url
}: {
  title: React.ReactElement | string;
  headerRightContent: React.ReactElement | string;
  footer: React.ReactElement | string;
  footerRightContent?: React.ReactElement | string;
  marketBalances: MarketBalanceForAccordion[];
  urlMap: Record<string, string>;
  icon?: React.ReactNode;
  url?: string;
}): React.ReactElement => {
  const marketsWithBalance = marketBalances.filter(m => m.balance > 0n);

  // If only one market has balance, show simple card
  if (marketsWithBalance.length <= 1) {
    const single = marketsWithBalance[0];
    return (
      <InteractiveStatsCard
        title={title}
        headerRightContent={headerRightContent}
        footer={footer}
        footerRightContent={footerRightContent}
        url={single ? urlMap[single.marketAddress] : url}
        icon={icon}
      />
    );
  }

  const headerContent = (
    <div className="flex items-center gap-2">
      {icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center">{icon}</div>}
      <div className="grow">
        <CardContent className="flex items-center justify-between gap-4">
          <Text>{title}</Text>
          {headerRightContent}
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-start justify-between">
            <div className="flex-1">{footer}</div>
            {footerRightContent}
          </div>
        </CardFooter>
      </div>
    </div>
  );

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="details" className="accordion-item border-0">
        <Card
          variant="stats"
          className="has-[.header-link:hover]:from-primary-start has-[.header-link:hover]:to-primary-end w-full px-0! transition-colors has-[.header-link:hover]:bg-radial-(--gradient-position)"
        >
          <div className="group/header-link relative -mt-3 px-4 pt-3 pb-1 lg:-mt-5 lg:px-5 lg:pt-5">
            <div>{headerContent}</div>
            {url && (
              <Link
                to={url}
                aria-label={typeof title === 'string' ? title : undefined}
                className="header-link absolute inset-0 z-0 h-full w-full"
              />
            )}
          </div>
          <AccordionTrigger className="-mb-3 w-full px-4 pb-5 hover:no-underline lg:-mb-5 lg:px-5 lg:pb-5 [&>svg]:hidden">
            <HStack className="w-full justify-between pt-1.5">
              <HStack className="items-center -space-x-0.5 opacity-100 transition-opacity duration-200 [.accordion-item[data-state=open]_&]:opacity-0">
                {marketsWithBalance.map(({ marketAddress, tokenIconSymbol }, index) => (
                  <div key={marketAddress} style={{ zIndex: marketsWithBalance.length - index }}>
                    <TokenIcon
                      className="h-4.25 w-4.25"
                      token={{ symbol: tokenIconSymbol, name: tokenIconSymbol }}
                      noChain={true}
                    />
                  </div>
                ))}
              </HStack>
              <HStack className="text-textSecondary w-full items-center justify-end gap-0.5">
                <Text variant="small" className="leading-none">
                  Funds by market
                </Text>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="chevron transition-transform duration-200 [.accordion-item[data-state=open]_&]:rotate-180"
                >
                  <path
                    d="M2 4L6 8L10 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </HStack>
            </HStack>
          </AccordionTrigger>
          <AccordionContent className="mt-2 p-0">
            {marketsWithBalance.map(
              ({
                marketName,
                marketAddress,
                balance,
                tokenIconSymbol,
                balanceDecimals,
                valuationUsd,
                rate,
                isMatured
              }) => {
                const marketUrl = urlMap[marketAddress];

                const rowContent = (
                  <div className="group/interactive-card from-primary-start/0 to-primary-end/0 hover:from-primary-start hover:to-primary-end cursor-pointer bg-radial-(--gradient-position) transition-colors">
                    <div className="flex items-start gap-2 p-2 px-4 lg:px-5">
                      <TokenIcon
                        className="h-8 w-8"
                        token={{ symbol: tokenIconSymbol, name: tokenIconSymbol }}
                        noChain={true}
                      />
                      <div className="grow">
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col">
                            <Text>{marketName}</Text>
                            <HStack gap={2} className="items-center">
                              {isMatured ? (
                                <Text variant="small" className="text-textSecondary">
                                  Matured
                                </Text>
                              ) : rate !== undefined && rate > 0 ? (
                                <Text variant="small" className="text-bullish">
                                  Rate: {(rate * 100).toFixed(2)}%
                                </Text>
                              ) : null}
                              {marketUrl && (
                                <ArrowRight
                                  size={16}
                                  className="opacity-0 transition-opacity group-hover/interactive-card:opacity-100"
                                />
                              )}
                            </HStack>
                          </div>
                          <div className="flex flex-col items-end">
                            <Text>{formatBigInt(balance, { unit: balanceDecimals })}</Text>
                            <Text variant="small" className="text-textSecondary">
                              ${formatNumber(valuationUsd, { maxDecimals: 2 })}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return marketUrl ? (
                  <Link to={marketUrl} key={marketAddress}>
                    {rowContent}
                  </Link>
                ) : (
                  <div key={marketAddress}>{rowContent}</div>
                );
              }
            )}
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
};
