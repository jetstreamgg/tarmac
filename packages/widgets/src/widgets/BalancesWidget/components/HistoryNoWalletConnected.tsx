import { Card } from '@widgets/components/ui/card';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';

export const HistoryNoWalletConnected = () => {
  return (
    <>
      <Card>
        <div className="flex">
          <Skeleton className="bg-card mr-3 h-[32px] w-[32px] min-w-[32px] rounded-full" />
          <div className="flex w-full justify-between">
            <div>
              <Skeleton className="bg-card mb-1 h-[19px] w-[65px] rounded" />
              <Skeleton className="bg-card h-[13px] w-[32px] rounded" />
            </div>
            <div className="flex flex-col items-end">
              <Skeleton className="bg-card h-[20px] w-[20px] rounded" />
            </div>
          </div>
        </div>
      </Card>
      <Card variant="fade" className="mt-2 h-[68px] w-full">
        <div className="flex h-full flex-col justify-end">
          <Text className="text-textSecondary text-center text-sm leading-4">
            <Trans>Connect a wallet to view your transaction history.</Trans>
          </Text>
        </div>
      </Card>
    </>
  );
};
