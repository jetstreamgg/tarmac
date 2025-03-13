import { useContext, useMemo } from 'react';
import { ConfigContext } from '@/modules/config/context/ConfigContext';
import { ActivationOverview } from './ActivationOverview';
import { ActivationPositionDetails } from './ActivationPositionDetails';
import { ActiveActivationDetailsView } from '../constants';

export function ActivationDetailsPane() {
  const { selectedActivationUrnIndex } = useContext(ConfigContext);
  const view = useMemo(
    () =>
      selectedActivationUrnIndex !== undefined
        ? ActiveActivationDetailsView.DETAILS
        : ActiveActivationDetailsView.OVERVIEW,
    [selectedActivationUrnIndex]
  );

  return view === ActiveActivationDetailsView.DETAILS ? (
    <ActivationPositionDetails positionIndex={selectedActivationUrnIndex} />
  ) : (
    <ActivationOverview />
  );
}
