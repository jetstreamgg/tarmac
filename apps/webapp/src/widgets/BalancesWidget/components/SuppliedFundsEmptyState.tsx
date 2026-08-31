import { Card } from '@/widgets/components/ui/card';

export const SuppliedFundsEmptyState = () => {
  return (
    <>
      <Card>
        <div className="flex">
          <div className="bg-bgSecondary mr-3 h-[32px] w-[32px] min-w-[32px] rounded-full" />
          <div className="flex w-full justify-between">
            <div>
              <div className="bg-bgSecondary mb-1 h-[19px] w-[65px] rounded" />
              <div className="bg-bgSecondary h-[13px] w-[32px] rounded" />
            </div>
            <div className="flex flex-col items-end">
              <div className="bg-bgSecondary h-[20px] w-[20px] rounded" />
            </div>
          </div>
        </div>
      </Card>
      <Card variant="fade" className="mt-2 h-[68px] w-full" />
    </>
  );
};
