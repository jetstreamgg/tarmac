import { useContext, useEffect } from 'react';
import {
  rewardsClaimTitle,
  rewardsClaimAllLoadingButtonText,
  rewardsClaimAllSubtitle,
  rewardsClaimAllTxDescription
} from '../lib/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { useLingui } from '@lingui/react';

// TX Status wrapper to update copy
export const RewardsClaimAllTransactionStatus = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { i18n } = useLingui();
  const {
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    txStatus,
    setLoadingText,
    setStep,
    setOriginAmount,
    setOriginToken
  } = useContext(WidgetContext);

  useEffect(() => {
    setOriginToken();
    setOriginAmount();
  }, []);

  // Sets the title and subtitle of the card
  useEffect(() => {
    setLoadingText(i18n._(rewardsClaimAllLoadingButtonText({ txStatus })));
    setTxTitle(i18n._(rewardsClaimTitle[txStatus as keyof TxCardCopyText]));
    setTxSubtitle(i18n._(rewardsClaimAllSubtitle({ txStatus })));
    setTxDescription(i18n._(rewardsClaimAllTxDescription({ txStatus })));
    setStep(2);
  }, [txStatus, i18n.locale]);
  return <BatchTransactionStatus onExternalLinkClicked={onExternalLinkClicked} />;
};
