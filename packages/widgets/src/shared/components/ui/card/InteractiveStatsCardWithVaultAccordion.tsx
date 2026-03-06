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

export type VaultBalanceForAccordion = {
  vaultName: string;
  vaultAddress: `0x${string}`;
  balance: bigint;
  /** Balance normalized to 18 decimals for cross-asset comparison */
  balanceNormalized: bigint;
  assetSymbol: string;
  assetDecimals: number;
  rate?: number;
};

export const InteractiveStatsCardWithVaultAccordion = ({
  title,
  headerRightContent,
  footer,
  footerRightContent,
  vaultBalances,
  urlMap,
  pricesData,
  icon
}: {
  title: React.ReactElement | string;
  headerRightContent: React.ReactElement | string;
  footer: React.ReactElement | string;
  footerRightContent?: React.ReactElement | string;
  vaultBalances: VaultBalanceForAccordion[];
  urlMap: Record<string, string>;
  pricesData: Record<string, PriceData>;
  icon?: React.ReactNode;
}): React.ReactElement => {
  // Use vault balances as-is (filtering is handled by parent based on hideZeroBalances)
  const vaultsWithBalance = vaultBalances;

  // If only one vault has balance, show simple card
  if (vaultsWithBalance.length <= 1) {
    const singleVault = vaultsWithBalance[0];
    return (
      <InteractiveStatsCard
        title={title}
        headerRightContent={headerRightContent}
        footer={footer}
        footerRightContent={footerRightContent}
        url={singleVault ? urlMap[singleVault.vaultAddress] : undefined}
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
              <div className="flex items-center gap-2">
                {icon && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">{icon}</div>
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
              <HStack className="my-2 w-full justify-between">
                <HStack className="items-center -space-x-0.5 opacity-100 transition-opacity duration-200 [.accordion-item[data-state=open]_&]:opacity-0">
                  {vaultsWithBalance.map(({ vaultAddress, assetSymbol }, index) => (
                    <div key={vaultAddress} style={{ zIndex: vaultsWithBalance.length - index }}>
                      <TokenIcon
                        className="h-[17px] w-[17px]"
                        token={{ symbol: assetSymbol, name: assetSymbol }}
                        noChain={true}
                      />
                    </div>
                  ))}
                </HStack>
                <HStack className="text-textSecondary w-full items-center justify-end gap-0.5">
                  <Text variant="small" className="leading-none">
                    Funds by vault
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
            {vaultsWithBalance.map(({ vaultName, vaultAddress, balance, assetSymbol, assetDecimals, rate }) => {
              // Use USDS price as approximation for stablecoin vaults
              const usdValue = pricesData?.USDS?.price
                ? parseFloat(formatUnits(balance, assetDecimals)) * parseFloat(pricesData.USDS.price)
                : 0;

              const vaultUrl = urlMap[vaultAddress];

              const rowContent = (
                <div className="group/interactive-card from-primary-start/0 to-primary-end/0 hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer bg-radial-(--gradient-position) transition-colors">
                  <div className="flex items-start gap-2 p-2 px-4 lg:px-5">
                    <TokenIcon
                      className="h-8 w-8"
                      token={{ symbol: assetSymbol, name: assetSymbol }}
                      noChain={true}
                    />
                    <div className="grow">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                          <Text>{vaultName}</Text>
                          <HStack className="items-center gap-1">
                            {rate !== undefined && rate > 0 && (
                              <Text variant="small" className="text-bullish">
                                {(rate * 100).toFixed(2)}%
                              </Text>
                            )}
                            {vaultUrl && (
                              <ArrowRight
                                size={16}
                                className="opacity-0 transition-opacity group-hover/interactive-card:opacity-100"
                              />
                            )}
                          </HStack>
                        </div>
                        <div className="flex flex-col items-end">
                          <Text>
                            {formatBigInt(balance, { unit: assetDecimals })}
                          </Text>
                          <Text variant="small" className="text-textSecondary">
                            ${formatNumber(usdValue, { maxDecimals: 2 })}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

              return vaultUrl ? (
                <Link to={vaultUrl} key={vaultAddress}>
                  {rowContent}
                </Link>
              ) : (
                <div key={vaultAddress}>{rowContent}</div>
              );
            })}
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
};
