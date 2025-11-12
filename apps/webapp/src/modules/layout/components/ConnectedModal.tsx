import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t } from '@lingui/core/macro';
import { X } from 'lucide-react';
import { Text } from '@/modules/layout/components/Typography';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import {
  getEtherscanLink,
  formatBigInt,
  useFormatDates,
  formatNumber,
  getCowExplorerLink,
  getChainIcon
} from '@jetstreamgg/sky-utils';
import {
  useAllNetworksCombinedHistory,
  TransactionTypeEnum,
  ModuleEnum,
  useAvailableTokenRewardContractsForChains,
  getTokenDecimals,
  TokenForChain,
  TOKENS
} from '@jetstreamgg/sky-hooks';
import { formatUnits } from 'viem';
import { useEffect, useMemo } from 'react';
import { useLingui } from '@lingui/react';
import { ExternalLink as ExternalLinkComponent } from '@/modules/layout/components/ExternalLink';
import { absBigInt } from '@/modules/utils/math';
import { Stake, Trade, Upgrade, Seal, Savings, RewardsModule, Expert } from '@/modules/icons';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { CopyToClipboard } from '@/modules/ui/components/CopyToClipboard';
import { HStack } from './HStack';
import { VStack } from './VStack';
import { Link } from 'react-router-dom';

const MAX_TRANSACTIONS = 6;

interface ConnectedModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  ensName?: string | null;
  ensAvatar?: string | null;
  connectorName?: string;
  onDisconnect: () => void;
}

export function ConnectedModal({
  isOpen,
  onOpenChange,
  address,
  ensName,
  ensAvatar,
  connectorName,
  onDisconnect
}: ConnectedModalProps) {
  const { i18n } = useLingui();
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  // Fetch all transaction history from subgraphs across all networks
  const { data: allHistory, mutate } = useAllNetworksCombinedHistory();

  // Get reward contracts configuration for token symbol lookup
  const getRewardContracts = useAvailableTokenRewardContractsForChains();

  useEffect(() => {
    mutate();
  }, [isOpen]);

  // Take only the most recent transactions across all chains
  const recentTransactions = useMemo(() => {
    if (!allHistory) return [];
    return allHistory.slice(0, MAX_TRANSACTIONS);
  }, [allHistory]);

  // Format dates using the same pattern as history tables
  const memoizedDates = useMemo(() => recentTransactions.map(tx => tx.blockTimestamp), [recentTransactions]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  const formatAddress = (addr: string, format: 'short' | 'long' = 'short') => {
    if (format === 'long') {
      return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getModulePrefix = (module: ModuleEnum): string => {
    switch (module) {
      case ModuleEnum.SAVINGS:
        return 'Savings';
      case ModuleEnum.STUSDS:
        return 'stUSDS';
      case ModuleEnum.STAKE:
        return 'Stake';
      case ModuleEnum.SEAL:
        return 'Seal';
      case ModuleEnum.REWARDS:
        return 'Rewards';
      case ModuleEnum.TRADE:
        return 'Trade';
      case ModuleEnum.UPGRADE:
        return 'Upgrade';
      default:
        return '';
    }
  };

  const getAmount = (tx: any): string | null => {
    // Savings transactions: assets field
    if (tx.module === ModuleEnum.SAVINGS && tx.assets) {
      const token = tx.token?.symbol || '';
      const decimals = getTokenDecimals(tx.token, tx.chainId);
      return `${formatBigInt(absBigInt(tx.assets), { compact: true, unit: decimals })} ${token}`;
    }

    // Upgrade transactions (DAI/USDS): wad field
    if (
      tx.wad &&
      (tx.type === TransactionTypeEnum.DAI_TO_USDS || tx.type === TransactionTypeEnum.USDS_TO_DAI)
    ) {
      const token = tx.type === TransactionTypeEnum.DAI_TO_USDS ? TOKENS.dai : TOKENS.usds;
      const decimals = getTokenDecimals(token, tx.chainId);
      return `${formatBigInt(absBigInt(tx.wad), { compact: true, unit: decimals })} ${token.symbol}`;
    }

    // Upgrade transactions (MKR/SKY): mkrAmt or skyAmt
    if (tx.mkrAmt && tx.type === TransactionTypeEnum.MKR_TO_SKY) {
      const decimals = getTokenDecimals(TOKENS.mkr, tx.chainId);
      return `${formatBigInt(absBigInt(tx.mkrAmt), { compact: true, unit: decimals })} ${TOKENS.mkr.symbol}`;
    }
    if (tx.skyAmt && tx.type === TransactionTypeEnum.SKY_TO_MKR) {
      const decimals = getTokenDecimals(TOKENS.sky, tx.chainId);
      return `${formatBigInt(absBigInt(tx.skyAmt), { compact: true, unit: decimals })} ${TOKENS.sky.symbol}`;
    }

    // Rewards transactions: amount field
    if (tx.amount && tx.module === ModuleEnum.REWARDS) {
      // Find the reward contract for this transaction
      const rewardContracts = getRewardContracts(tx.chainId);
      const rewardContract = rewardContracts.find(
        rc => rc.contractAddress.toLowerCase() === tx.rewardContractAddress?.toLowerCase()
      );

      if (rewardContract) {
        // Use rewardToken for claims, supplyToken for supply/withdraw
        const token =
          tx.type === TransactionTypeEnum.REWARD ? rewardContract.rewardToken : rewardContract.supplyToken;
        const decimals = getTokenDecimals(token, tx.chainId);
        return `${formatBigInt(absBigInt(tx.amount), { compact: true, unit: decimals })} ${token.symbol}`;
      }

      // Fallback if contract not found
      const token = tx.token?.symbol || '';
      const decimals = getTokenDecimals(tx.token, tx.chainId);
      return `${formatBigInt(absBigInt(tx.amount), { compact: true, unit: decimals })} ${token}`;
    }

    // Stake transactions: amount field with SKY token
    if (tx.amount && tx.module === ModuleEnum.STAKE) {
      // Borrowed USDS for stake borrow, otherwise SKY
      const token = tx.type === TransactionTypeEnum.STAKE_BORROW ? TOKENS.usds : TOKENS.sky;
      const decimals = getTokenDecimals(token, tx.chainId);
      return `${formatBigInt(absBigInt(tx.amount), { compact: true, unit: decimals })} ${token.symbol}`;
    }

    // Seal transactions: amount field with MKR token
    if (tx.amount && tx.module === ModuleEnum.SEAL) {
      // NST is the old name for USDS
      const token = tx.type === TransactionTypeEnum.SEAL_REWARD ? TOKENS.usds : TOKENS.mkr;
      const decimals = getTokenDecimals(token, tx.chainId);
      return `${formatBigInt(absBigInt(tx.amount), { compact: true, unit: decimals })} ${token.symbol}`;
    }

    // stUSDS (Expert) transactions: assets field with USDS token
    if (tx.assets && tx.module === ModuleEnum.STUSDS) {
      const decimals = getTokenDecimals(TOKENS.usds, tx.chainId);
      return `${formatBigInt(absBigInt(tx.assets), { compact: true, unit: decimals })} ${TOKENS.usds.symbol}`;
    }

    // Stake kick: wad field with SKY token
    if (
      tx.wad &&
      tx.type !== TransactionTypeEnum.DAI_TO_USDS &&
      tx.type !== TransactionTypeEnum.USDS_TO_DAI
    ) {
      const decimals = getTokenDecimals(TOKENS.sky, tx.chainId);
      return `${formatBigInt(absBigInt(tx.wad), { compact: true, unit: decimals })} ${TOKENS.sky.symbol}`;
    }

    return null;
  };

  const getTransactionIcon = (tx: any) => {
    const iconProps = { width: 24, height: 24 };

    // Use simple module-level icons
    switch (tx.module) {
      case ModuleEnum.REWARDS:
        return <RewardsModule {...iconProps} />;
      case ModuleEnum.SAVINGS:
        return <Savings {...iconProps} />;
      case ModuleEnum.STUSDS:
        return <Expert {...iconProps} />;
      case ModuleEnum.STAKE:
        return <Stake {...iconProps} />;
      case ModuleEnum.TRADE:
        return <Trade {...iconProps} />;
      case ModuleEnum.UPGRADE:
        return <Upgrade {...iconProps} />;
      case ModuleEnum.SEAL:
        return <Seal {...iconProps} />;
      default:
        return null;
    }
  };

  const getExplorerLink = (tx: any): string => {
    // Use CoW Explorer for trade transactions that have cowOrderStatus
    if (tx.module === ModuleEnum.TRADE && 'cowOrderStatus' in tx) {
      return getCowExplorerLink(tx.chainId, tx.transactionHash);
    }
    // Default to Etherscan for all other transactions
    return getEtherscanLink(tx.chainId, tx.transactionHash, 'tx');
  };

  const getTransactionDescription = (tx: any, isMobile: boolean = false): string => {
    const module = tx.module;
    const prefix = getModulePrefix(module);
    const amount = getAmount(tx);

    // Rewards module - natural language descriptions
    if (module === ModuleEnum.REWARDS) {
      if (tx.type === TransactionTypeEnum.REWARD) {
        return amount ? `Claimed ${amount}${isMobile ? '' : ' in Rewards'}` : 'Claimed rewards';
      }
      if (tx.type === TransactionTypeEnum.SUPPLY) {
        return amount ? `Supplied ${amount}${isMobile ? '' : ' to Rewards'}` : 'Supplied to Rewards';
      }
      if (tx.type === TransactionTypeEnum.WITHDRAW) {
        return amount ? `Withdrew ${amount}${isMobile ? '' : ' from Rewards'}` : 'Withdrew from Rewards';
      }
    }

    // Savings module - natural language descriptions
    if (module === ModuleEnum.SAVINGS) {
      if (tx.type === TransactionTypeEnum.SUPPLY) {
        return amount ? `Supplied ${amount}${isMobile ? '' : ' to Savings'}` : 'Supplied to Savings';
      }
      if (tx.type === TransactionTypeEnum.WITHDRAW) {
        return amount ? `Withdrew ${amount}${isMobile ? '' : ' from Savings'}` : 'Withdrew from Savings';
      }
    }

    // stUSDS module - natural language descriptions
    if (module === ModuleEnum.STUSDS) {
      if (tx.type === TransactionTypeEnum.SUPPLY) {
        return amount ? `Supplied ${amount}${isMobile ? '' : ' to stUSDS'}` : 'Supplied to stUSDS';
      }
      if (tx.type === TransactionTypeEnum.WITHDRAW) {
        return amount ? `Withdrew ${amount}${isMobile ? '' : ' from stUSDS'}` : 'Withdrew from stUSDS';
      }
    }

    // Stake module - natural language descriptions
    if (module === ModuleEnum.STAKE) {
      if (tx.type === TransactionTypeEnum.STAKE) {
        return amount ? `Staked ${amount}` : 'Staked SKY';
      }
      if (tx.type === TransactionTypeEnum.UNSTAKE) {
        return amount ? `Unstaked ${amount}` : 'Unstaked SKY';
      }
      if (tx.type === TransactionTypeEnum.STAKE_BORROW) {
        return amount ? `Borrowed ${amount}` : 'Borrowed USDS';
      }
      if (tx.type === TransactionTypeEnum.STAKE_REPAY) {
        return amount ? `Repaid ${amount}` : 'Repaid USDS';
      }
      if (tx.type === TransactionTypeEnum.STAKE_REWARD) {
        return amount ? `Claimed ${amount} in staking rewards` : 'Claimed staking rewards';
      }
      if (tx.type === TransactionTypeEnum.STAKE_OPEN) {
        return 'Opened staking position';
      }
      if (tx.type === TransactionTypeEnum.STAKE_SELECT_DELEGATE) {
        return 'Selected delegate';
      }
      if (tx.type === TransactionTypeEnum.STAKE_SELECT_REWARD) {
        return 'Selected reward contract';
      }
      if (tx.type === TransactionTypeEnum.UNSTAKE_KICK) {
        return amount ? `Liquidated ${amount}` : 'Position liquidated';
      }
    }

    // Upgrade module - natural language descriptions
    if (module === ModuleEnum.UPGRADE) {
      if (tx.type === TransactionTypeEnum.DAI_TO_USDS) {
        return amount ? `Upgraded ${amount} to USDS` : 'Upgraded DAI to USDS';
      }
      if (tx.type === TransactionTypeEnum.USDS_TO_DAI) {
        return amount ? `Downgraded ${amount} to DAI` : 'Downgraded USDS to DAI';
      }
      if (tx.type === TransactionTypeEnum.MKR_TO_SKY) {
        return amount ? `Upgraded ${amount} to SKY` : 'Upgraded MKR to SKY';
      }
      if (tx.type === TransactionTypeEnum.SKY_TO_MKR) {
        return amount ? `Downgraded ${amount} to MKR` : 'Downgraded SKY to MKR';
      }
    }

    // Trade module - natural language descriptions
    if (module === ModuleEnum.TRADE) {
      if (tx.fromAmount && tx.toAmount && tx.fromToken && tx.toToken) {
        // Format trade amounts with proper decimals like TradeHistory does
        const formatTradeAmount = (input: bigint, token: any): string => {
          const decimals = getTokenDecimals(token as TokenForChain, tx.chainId);
          return formatNumber(parseFloat(formatUnits(input, decimals)), {
            locale: i18n.locale,
            compact: true
          });
        };

        const fromAmount = `${formatTradeAmount(tx.fromAmount, tx.fromToken)} ${tx.fromToken.symbol}`;
        const toAmount = `${formatTradeAmount(tx.toAmount, tx.toToken)} ${tx.toToken.symbol}`;

        // Add CoW order status if available
        const statusSuffix = 'cowOrderStatus' in tx ? ` - ${tx.cowOrderStatus}` : '';
        return `Traded ${fromAmount} for ${toAmount}${statusSuffix}`;
      }
      return 'Traded tokens';
    }

    // Other modules - keeping old format for now
    const typeDescriptions: Record<string, string> = {
      [TransactionTypeEnum.SUPPLY]: amount ? `${amount} - ${prefix} Supply` : `${prefix}: Supply`,
      [TransactionTypeEnum.WITHDRAW]: amount ? `${amount} - ${prefix} Withdrawal` : `${prefix}: Withdrawal`,
      [TransactionTypeEnum.TRADE]: `${prefix}: Swap`,
      [TransactionTypeEnum.DAI_TO_USDS]: amount ? `${amount} - ${prefix} Upgrade` : `${prefix}: DAI → USDS`,
      [TransactionTypeEnum.MKR_TO_SKY]: amount ? `${amount} - ${prefix} Upgrade` : `${prefix}: MKR → SKY`,
      [TransactionTypeEnum.SKY_TO_MKR]: amount ? `${amount} - ${prefix} Downgrade` : `${prefix}: SKY → MKR`,
      [TransactionTypeEnum.USDS_TO_DAI]: amount ? `${amount} - ${prefix} Downgrade` : `${prefix}: USDS → DAI`,
      [TransactionTypeEnum.STAKE]: amount ? `${amount} - ${prefix} Stake` : `${prefix}: Stake`,
      [TransactionTypeEnum.UNSTAKE]: amount ? `${amount} - ${prefix} Unstake` : `${prefix}: Unstake`,
      [TransactionTypeEnum.STAKE_BORROW]: amount ? `${amount} - ${prefix} Borrow` : `${prefix}: Borrow`,
      [TransactionTypeEnum.STAKE_REPAY]: amount ? `${amount} - ${prefix} Repay` : `${prefix}: Repay`,
      [TransactionTypeEnum.STAKE_REWARD]: amount ? `${amount} - ${prefix} Claim` : `${prefix}: Claim`,
      [TransactionTypeEnum.STAKE_OPEN]: `${prefix}: Open position`,
      [TransactionTypeEnum.STAKE_SELECT_DELEGATE]: `${prefix}: Select delegate`,
      [TransactionTypeEnum.STAKE_SELECT_REWARD]: `${prefix}: Select reward`,
      [TransactionTypeEnum.SEAL]: amount ? `${amount} - ${prefix} Seal` : `${prefix}: Seal`,
      [TransactionTypeEnum.UNSEAL]: amount ? `${amount} - ${prefix} Unseal` : `${prefix}: Unseal`,
      [TransactionTypeEnum.SEAL_REWARD]: amount ? `${amount} - ${prefix} Claim` : `${prefix}: Claim`
    };

    return typeDescriptions[tx.type] || `${prefix}: ${tx.type}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-containerDark p-0 sm:max-w-[400px]">
        <div className="border-borderPrimary flex items-center justify-between border-b px-6 py-5">
          <DialogTitle>
            <Text className="text-text text-xl font-semibold">{t`Account`}</Text>
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0">
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-col items-center gap-4">
            {ensAvatar ? (
              <img alt="ENS Avatar" className="h-20 w-20 rounded-full" src={ensAvatar} />
            ) : (
              <CustomAvatar address={address} size={80} />
            )}
            <VStack className="text-center">
              <HStack className="w-fit items-center self-center">
                <div className="text-text text-lg font-medium">{ensName || formatAddress(address)}</div>
                <div className="cursor-pointer">
                  <CopyToClipboard text={address} />
                </div>
              </HStack>
              {ensName && (
                <div className="text-textSecondary mt-1 text-sm">{formatAddress(address, 'long')}</div>
              )}
              {connectorName && (
                <div className="text-textSecondary mt-2 text-sm">Connected with {connectorName}</div>
              )}
            </VStack>
          </div>

          {/* Recent Transactions Section */}
          {recentTransactions.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <Text className="text-textSecondary text-xs font-medium md:text-sm">{t`Recent Transactions`}</Text>
                <Link
                  to="/?widget=balances&flow=tx_history"
                  onClick={() => onOpenChange(false)}
                  className="text-textSecondary hover:text-text text-[10px] transition-colors md:text-xs"
                >
                  {t`View all`} →
                </Link>
              </div>
              <div className="scrollbar-thin-always scrollbar-thin scrollbar-track-transparent scrollbar-thumb-borderPrimary hover:scrollbar-thumb-textSecondary max-h-[40vh] space-y-1 overflow-y-auto pr-1">
                {recentTransactions.map((tx, index) => (
                  <a
                    key={tx.transactionHash}
                    href={getExplorerLink(tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-brandLight/20 active:bg-brandLight/10 flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className="relative mt-1">
                        <div className="text-textSecondary">{getTransactionIcon(tx)}</div>
                        <div className="bg-containerDark absolute -right-1.5 -bottom-1 h-4.5 w-4.5 rounded-full p-0.5">
                          {getChainIcon(tx.chainId, 'h-full w-full')}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Text className="text-text truncate text-sm md:text-base">
                          {getTransactionDescription(tx, isMobile)}
                        </Text>
                        <Text variant="small" className="text-textSecondary text-xs md:text-sm">
                          {formattedDates.length > index ? formattedDates[index] : ''}
                        </Text>
                      </div>
                    </div>
                    <ExternalLinkComponent href={getExplorerLink(tx)} iconSize={13} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <Button variant="connect" onClick={onDisconnect} className="w-full">
            {t`Disconnect Wallet`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
