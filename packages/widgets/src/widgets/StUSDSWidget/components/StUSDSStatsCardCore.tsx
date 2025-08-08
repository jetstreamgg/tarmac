import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { JSX } from 'react';

export const StUSDSStatsCardCore = ({ content }: { content: JSX.Element; isLoading: boolean }) => {
  return (
    <StatsOverviewCardCore
      headerLeftContent={<></>}
      headerRightContent={<></>}
      content={content}
      className="cursor-default"
    />
  );
};
