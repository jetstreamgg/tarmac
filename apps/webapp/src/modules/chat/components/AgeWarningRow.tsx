import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useCallback } from 'react';
import { Warning } from '@/modules/icons/Warning';

export const AgeWarningRow = () => {
  const { setHasAcceptedAgeRestriction } = useChatContext();

  const handleConfirm = useCallback(() => {
    setHasAcceptedAgeRestriction(true);
  }, [setHasAcceptedAgeRestriction]);

  return (
    <div className="text-text mt-5 rounded-xl bg-[#0b0b0c]/60 p-5">
      <div className="flex items-center gap-2">
        <Warning boxSize={20} viewBox="0 0 16 16" fill="#fdc134" />
        <Text variant="medium">You must be at least 18 years old to use this service.</Text>
      </div>
      <Text variant="terms" className="mt-2">
        By clicking, you confirm that you are at least 18 years old and agree to comply with all applicable
        laws and regulations regarding age restrictions.
      </Text>
      <div className="mt-3 flex gap-5">
        <Button variant="pill" size="xs" onClick={handleConfirm}>
          I am at least 18 years old
        </Button>
      </div>
    </div>
  );
};
