import { Card, CardContent, CardFooter } from '@widgets/components/ui/card';
import { Text } from '../Typography';
import { TokenIcon } from '../token/TokenIcon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@widgets/components/ui/accordion';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowRight } from 'lucide-react';
import { formatUnits } from 'viem';
import { useChains } from 'wagmi';
import { formatBigInt, formatNumber, getChainIcon } from '@jetstreamgg/sky-utils';
import { Link } from 'react-router-dom';
import { InteractiveStatsCard } from './InteractiveStatsCard';
import { PriceData } from '@jetstreamgg/sky-hooks';

export const InteractiveStatsCardWithAccordion = ({
  title,
  headerRightContent,
  footer,
  footerRightContent,
  tokenSymbol,
  balancesByChain,
  urlMap,
  pricesData
}: {
  title: React.ReactElement | string;
  headerRightContent: React.ReactElement | string;
  footer: React.ReactElement | string;
  footerRightContent?: React.ReactElement | string;
  tokenSymbol: string;
  balancesByChain: { chainId: number; balance: bigint }[];
  urlMap: Record<number, string>;
  pricesData: Record<string, PriceData>;
}): React.ReactElement => {
  const chains = useChains();
  if (balancesByChain.length === 1) {
    return (
      <InteractiveStatsCard
        title={title}
        headerRightContent={headerRightContent}
        footer={footer}
        footerRightContent={footerRightContent}
        tokenSymbol={tokenSymbol}
        url={urlMap[balancesByChain[0].chainId]}
        chainId={balancesByChain[0].chainId}
      />
    );
  }
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="details" className="accordion-item border-0">
        <AccordionTrigger className="w-full p-0 hover:no-underline [&>svg]:hidden">
          <Card variant="stats" className="w-full px-0 pb-4 lg:px-0">
            <div className="px-4 lg:px-5">
              <div className="flex items-center gap-2">
                {tokenSymbol && (
                  <TokenIcon
                    className="h-8 w-8"
                    token={{ symbol: tokenSymbol, name: tokenSymbol }}
                    noChain={true}
                  />
                )}
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
              <HStack className="my-2">
                <HStack className="items-center -space-x-0.5 opacity-100 transition-opacity duration-200 [.accordion-item[data-state=open]_&]:opacity-0">
                  {balancesByChain.map(({ chainId }, index) => (
                    <div key={chainId} style={{ zIndex: balancesByChain.length - index }}>
                      {getChainIcon(chainId, 'h-[17px] w-[17px]')}
                    </div>
                  ))}
                </HStack>
                <HStack className="text-textSecondary w-full items-center justify-end gap-0.5">
                  <Text variant="small" className="leading-none">
                    Funds by network
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
            </div>
            <AccordionContent className="p-0">
              {balancesByChain.map(({ chainId, balance }) => {
                const networkName = chains.find(c => c.id === chainId)?.name;
                const usdValue = pricesData?.USDS?.price
                  ? parseFloat(formatUnits(balance, 18)) * parseFloat(pricesData.USDS.price)
                  : 0;

                return (
                  <Link to={urlMap[chainId]} key={chainId}>
                    <div className="group/interactive-card from-primary-start/0 to-primary-end/0 hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer bg-radial-(--gradient-position) transition-colors">
                      <div className="flex items-start gap-2 p-2 px-4 lg:px-5">
                        <TokenIcon
                          className="h-8 w-8"
                          token={{ symbol: 'USDS', name: 'USDS' }}
                          chainId={chainId}
                        />
                        <div className="grow">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col">
                              <Text>{networkName}</Text>
                              <ArrowRight
                                size={16}
                                className="opacity-0 transition-opacity group-hover/interactive-card:opacity-100"
                              />
                            </div>
                            <div className="flex flex-col items-end">
                              <Text>{formatBigInt(balance)}</Text>
                              <Text variant="small" className="text-textSecondary">
                                ${formatNumber(usdValue, { maxDecimals: 2 })}
                              </Text>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </AccordionContent>
          </Card>
        </AccordionTrigger>
      </AccordionItem>
    </Accordion>
  );
};
