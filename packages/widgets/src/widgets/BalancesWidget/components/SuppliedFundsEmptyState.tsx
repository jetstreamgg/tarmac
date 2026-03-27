import { Card } from '@widgets/components/ui/card';

export const SuppliedFundsEmptyState = () => {
  return (
    <>
      <Card>
        <div className="flex">
          <div className="mr-3 h-[32px] w-[32px] min-w-[32px] rounded-full bg-white/5" />
          <div className="flex w-full justify-between">
            <div>
              <div className="mb-1 h-[19px] w-[65px] rounded bg-white/5" />
              <div className="h-[13px] w-[32px] rounded bg-white/5" />
            </div>
            <div className="flex flex-col items-end">
              <div className="h-[20px] w-[20px] rounded bg-white/5" />
            </div>
          </div>
        </div>
      </Card>
      <Card variant="fade" className="mt-2 h-[68px] w-full" />
    </>
  );
};
