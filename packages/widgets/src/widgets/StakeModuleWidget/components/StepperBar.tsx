import { Progress } from '@widgets/components/ui/progress';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Button } from '@widgets/components/ui/button';
import { Info } from '@widgets/shared/components/icons/Info';

export const StepperBar = ({
  step,
  totalSteps,
  title,
  onShowHelpModal
}: {
  step: number;
  totalSteps: number;
  title: string;
  onShowHelpModal?: () => void;
}) => {
  const progress = (step / totalSteps) * 100;

  return (
    <VStack gap={2}>
      <HStack className="justify-between">
        <Text className="text-sm leading-4">{title}</Text>
        <div className="flex items-center">
          <Text className="text-textSecondary text-sm leading-4">
            {step}/{totalSteps} STEPS
          </Text>
          {onShowHelpModal && (
            <Button className="text-textSecondary ml-1.5 h-auto min-h-0 p-0" onClick={onShowHelpModal}>
              <Info />
            </Button>
          )}
        </div>
      </HStack>
      <Progress value={progress} className="mt-1 h-0.5" />
    </VStack>
  );
};
