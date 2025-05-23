import React from 'react';
import { Text } from '@widgets/shared/components/ui/Typography';
import { TokenIcon } from './TokenIcon';
import { cn } from '@widgets/lib/utils';

interface TokenIconWithBalanceProps {
  token: {
    symbol: string;
    name: string;
  };
  balance: string;
  className?: string;
  textLarge?: boolean;
  compact?: boolean;
}

export const TokenIconWithBalance: React.FC<TokenIconWithBalanceProps> = ({
  token,
  balance,
  className,
  compact,
  textLarge = false
}) => (
  <div className={cn('flex items-start', className)}>
    {/* TODO the size should come from the width prop and not the class name */}
    <TokenIcon className="h-6 w-6" token={token} width={24} />
    <Text className={`ml-2 ${textLarge ? 'text-[18px]' : ''}`}>
      {compact ? balance : `${balance} ${token.symbol}`}
    </Text>
  </div>
);
