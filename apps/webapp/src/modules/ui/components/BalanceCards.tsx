import React, { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Card, CardTitle } from '@/components/ui/card';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { Supplied, SuppliedEmpty, WithdrawnEmpty, Withdrawn, Rewards, RewardsEmpty } from '@/modules/icons';
import { formatBigInt } from '@/utils';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingErrorWrapper } from './LoadingErrorWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { Token } from '@/hooks';
import { useChainId } from 'wagmi';
import { PopoverInfo } from '@/widgets';

interface BalanceCardProps {
  balance: bigint | string;
  isLoading: boolean;
  token: Pick<Token, 'symbol' | 'name'> & Partial<Pick<Token, 'decimals'>>;
  label?: string;
  labelTooltip?: { title: string; description: React.ReactNode };
  toggle?: React.ReactNode;
  error?: Error | null;
  afterBalance?: string;
  dataTestId?: string;
}

interface BaseBalanceCardProps extends BalanceCardProps {
  label: string;
  toggle?: React.ReactNode;
  icon: React.ReactElement;
  iconEmpty: React.ReactElement;
  className?: string;
  error?: Error | null;
}

function BaseBalanceCard({
  label,
  labelTooltip,
  toggle,
  balance,
  icon,
  iconEmpty,
  isLoading,
  token,
  className,
  error,
  afterBalance,
  dataTestId
}: BaseBalanceCardProps): React.ReactElement {
  const chainId = useChainId();
  const isPositiveBalance = useMemo(() => {
    if (typeof balance === 'bigint') {
      return balance > 0n;
    }
    if (typeof balance === 'string') {
      const numericPart = parseFloat(balance.replace(/[^0-9.-]+/g, ''));
      return !isNaN(numericPart) && numericPart > 0;
    }
    return false;
  }, [balance]);

  const decimals = typeof token.decimals === 'number' ? token.decimals : token.decimals?.[chainId];

  return (
    <Card variant="stats" className={cn('flex justify-between', className)}>
      <div className="flex w-full flex-col justify-center">
        <LoadingErrorWrapper
          isLoading={isLoading}
          loadingComponent={<LoadingBalanceCard label={label} />}
          error={error ? error : null}
          errorComponent={<ErrorComponent label={label} />}
        >
          <BaseBalanceCardContent label={label} labelTooltip={labelTooltip} toggle={toggle}>
            <TokenIconWithBalance
              token={token}
              balance={
                typeof balance === 'string' ? balance : formatBigInt(balance, { unit: decimals || 18 })
              }
              afterBalance={afterBalance}
              dataTestId={dataTestId}
            />
          </BaseBalanceCardContent>
        </LoadingErrorWrapper>
      </div>
      {isPositiveBalance ? icon : iconEmpty}
    </Card>
  );
}

function BaseBalanceCardContent({
  label,
  labelTooltip,
  toggle,
  children
}: {
  label: string;
  labelTooltip?: { title: string; description: React.ReactNode };
  toggle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {toggle ? (
        <div className="flex w-full gap-2">
          <CardTitle variant="stats" className="mb-2">
            {label}
          </CardTitle>
          {toggle}
        </div>
      ) : labelTooltip ? (
        <CardTitle variant="stats" className="mb-2 flex items-center gap-1">
          <span>{label}</span>
          <PopoverInfo
            title={labelTooltip.title}
            description={labelTooltip.description}
            iconClassName="text-textSecondary hover:text-white transition-colors"
          />
        </CardTitle>
      ) : (
        <CardTitle variant="stats" className="mb-2">
          {label}
        </CardTitle>
      )}
      {children}
    </>
  );
}

function LoadingBalanceCard({ label }: { label: string }) {
  return (
    <BaseBalanceCardContent label={label}>
      <Skeleton className="h5 w-16" />
    </BaseBalanceCardContent>
  );
}

function ErrorComponent({ label }: { label: string }) {
  return (
    <BaseBalanceCardContent label={label}>
      <Text>
        <Trans>Unable to fetch balance</Trans>
      </Text>
    </BaseBalanceCardContent>
  );
}

export function SuppliedBalanceCard({
  balance,
  isLoading,
  token,
  label,
  labelTooltip,
  error,
  afterBalance,
  dataTestId
}: BalanceCardProps): React.ReactElement {
  return (
    <BaseBalanceCard
      label={label || t`Savings balance`}
      labelTooltip={labelTooltip}
      balance={balance}
      icon={<Supplied />}
      iconEmpty={<SuppliedEmpty />}
      isLoading={isLoading}
      token={token}
      error={error}
      afterBalance={afterBalance}
      dataTestId={dataTestId}
    />
  );
}

export function UnsuppliedBalanceCard({
  balance,
  isLoading,
  token,
  label,
  error,
  dataTestId
}: BalanceCardProps): React.ReactElement {
  return (
    <BaseBalanceCard
      label={label || t`Remaining ${token.symbol} balance`}
      balance={balance}
      icon={<Withdrawn />}
      iconEmpty={<WithdrawnEmpty />}
      isLoading={isLoading}
      token={token}
      error={error}
      dataTestId={dataTestId}
    />
  );
}

export function RewardsBalanceCard({
  balance,
  isLoading,
  token,
  label,
  error
}: BalanceCardProps): React.ReactElement {
  return (
    <BaseBalanceCard
      label={label || t`Accumulated Rewards`}
      balance={balance}
      icon={<Rewards />}
      iconEmpty={<RewardsEmpty />}
      isLoading={isLoading}
      token={token}
      error={error}
    />
  );
}

export function SealSealedCard({
  balance,
  isLoading,
  token,
  label,
  error
}: BalanceCardProps): React.ReactElement {
  return (
    <BaseBalanceCard
      label={label || t`USDS borrowed`}
      balance={balance}
      icon={<Supplied />}
      iconEmpty={<SuppliedEmpty />}
      isLoading={isLoading}
      token={token}
      error={error}
    />
  );
}

export function SealBorrowedCard({
  balance,
  isLoading,
  token,
  label,
  error
}: BalanceCardProps): React.ReactElement {
  return (
    <BaseBalanceCard
      label={label || t`USDS borrowed`}
      balance={balance}
      icon={<Withdrawn />}
      iconEmpty={<WithdrawnEmpty />}
      isLoading={isLoading}
      token={token}
      error={error}
    />
  );
}
