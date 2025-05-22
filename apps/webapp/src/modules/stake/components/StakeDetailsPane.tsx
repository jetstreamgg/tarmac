import { useContext, useMemo } from 'react';
import { ConfigContext } from '@/modules/config/context/ConfigContext';
import { StakeOverview } from './StakeOverview';
import { StakePositionDetails } from './StakePositionDetails';
import { ActiveStakeDetailsView } from '../constants';

export function StakeDetailsPane() {
  const { selectedStakeUrnIndex } = useContext(ConfigContext);
  const view = useMemo(
    () =>
      selectedStakeUrnIndex !== undefined ? ActiveStakeDetailsView.DETAILS : ActiveStakeDetailsView.OVERVIEW,
    [selectedStakeUrnIndex]
  );

  return view === ActiveStakeDetailsView.DETAILS ? (
    <StakePositionDetails positionIndex={selectedStakeUrnIndex} />
  ) : (
    <StakeOverview />
  );
}
