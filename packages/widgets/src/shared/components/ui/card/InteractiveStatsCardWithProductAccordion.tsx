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
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { Link } from 'react-router-dom';
import { InteractiveStatsCard } from './InteractiveStatsCard';
import { PriceData } from '@jetstreamgg/sky-hooks';
import { MorphoVaultBadge } from '@widgets/widgets/MorphoVaultWidget/components/MorphoVaultBadge';
import { Trans } from '@lingui/react/macro';

export type ProductBalance = {
  productName: string;
  balance: bigint;
  rate?: string;
  isMorpho?: boolean;
  url?: string;
};

export const InteractiveStatsCardWithProductAccordion = ({
  title,
  headerRightContent,
  footer,
  footerRightContent,
  tokenSymbol,
  balancesByProduct,
  pricesData,
  url,
  icon
}: {
  title: React.ReactElement | string;
  headerRightContent: React.ReactElement | string;
  footer: React.ReactElement | string;
  footerRightContent?: React.ReactElement | string;
  tokenSymbol?: string;
  balancesByProduct: ProductBalance[];
  pricesData: Record<string, PriceData>;
  url?: string;
  icon?: React.ReactNode;
}): React.ReactElement => {
  // Filter to only products with non-zero balances and sort by largest balance
  const nonZeroProducts = balancesByProduct
    .filter(p => p.balance > 0n)
    .sort((a, b) => (a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1));

  if (nonZeroProducts.length <= 1) {
    return (
      <InteractiveStatsCard
        title={title}
        headerRightContent={headerRightContent}
        footer={footer}
        footerRightContent={footerRightContent}
        tokenSymbol={tokenSymbol}
        url={nonZeroProducts[0]?.url || url}
        icon={icon}
      />
    );
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="details" className="accordion-item border-0">
        <Card variant="stats" className="w-full px-0 pb-4 lg:px-0">
          <AccordionTrigger className="w-full p-0 hover:no-underline [&>svg]:hidden">
            <div className="w-full px-4 lg:px-5">
              <div className="flex w-full items-center gap-2">
                {icon ? (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">{icon}</div>
                ) : tokenSymbol ? (
                  <TokenIcon
                    className="h-8 w-8"
                    token={{ symbol: tokenSymbol, name: tokenSymbol }}
                    noChain={true}
                  />
                ) : null}
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
                  {nonZeroProducts.map(({ productName, isMorpho }, index) => (
                    <div key={productName} style={{ zIndex: nonZeroProducts.length - index }}>
                      {isMorpho ? (
                        <div className="flex h-[17px] w-[17px] items-center justify-center">
                          <MorphoVaultBadge />
                        </div>
                      ) : (
                        <TokenIcon
                          className="h-[17px] w-[17px]"
                          token={{ symbol: 'stUSDS', name: 'stUSDS' }}
                          noChain={true}
                        />
                      )}
                    </div>
                  ))}
                </HStack>
                <HStack className="text-textSecondary w-full items-center justify-end gap-0.5">
                  <Text variant="small" className="leading-none">
                    <Trans>Funds by product</Trans>
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
          </AccordionTrigger>
          <AccordionContent className="p-0">
            {nonZeroProducts.map(({ productName, balance, rate, isMorpho, url: productUrl }) => {
              const usdValue = pricesData?.USDS?.price
                ? parseFloat(formatUnits(balance, 18)) * parseFloat(pricesData.USDS.price)
                : 0;

              const content = (
                <div className="group/interactive-card from-primary-start/0 to-primary-end/0 hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer bg-radial-(--gradient-position) transition-colors">
                  <div className="flex items-start gap-2 p-2 px-4 lg:px-5">
                    {isMorpho ? (
                      <div className="flex h-8 w-8 items-center justify-center">
                        <MorphoVaultBadge className="h-8 w-8" />
                      </div>
                    ) : (
                      <TokenIcon
                        className="h-8 w-8"
                        token={{ symbol: 'stUSDS', name: 'stUSDS' }}
                        noChain={true}
                      />
                    )}
                    <div className="grow">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                          <Text>{productName}</Text>
                          <div className="flex items-center gap-2">
                            {rate && (
                              <Text variant="small" className="text-bullish">
                                {rate}
                              </Text>
                            )}
                            <ArrowRight
                              size={16}
                              className="opacity-0 transition-opacity group-hover/interactive-card:opacity-100"
                            />
                          </div>
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
              );

              return productUrl ? (
                <Link to={productUrl} key={productName}>
                  {content}
                </Link>
              ) : (
                <div key={productName}>{content}</div>
              );
            })}
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
};
