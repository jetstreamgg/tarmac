import { Progress } from '@widgets/components/ui/progress';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';

export const StepperBar = ({
  step,
  totalSteps,
  title
}: {
  step: number;
  totalSteps: number;
  title: string;
}) => {
  const progress = (step / totalSteps) * 100;

  return (
    <VStack gap={2}>
      <HStack className="justify-between">
        <Text className="text-sm leading-4">{title}</Text>
        <Text className="text-textSecondary text-sm leading-4">
          {step}/{totalSteps} STEPS
        </Text>
      </HStack>
      <Progress value={progress} className="mt-1 h-0.5" />
    </VStack>
  );
};
