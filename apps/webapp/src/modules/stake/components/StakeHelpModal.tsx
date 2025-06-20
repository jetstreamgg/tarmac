import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Close } from '@/modules/icons/Close';
import { HStack } from '@/modules/layout/components/HStack';
import { StakeColor } from '@/modules/icons/StakeColor';
import { Text } from '@/modules/layout/components/Typography';

const STAKING_STEPS = [
  {
    id: 'stake',
    title: <Trans>1. Supply SKY:</Trans>,
    content: (
      <Trans>
        Supply SKY to the Staking Engine to create one or more positions through which you access Staking
        Rewards and more.
        <br />
        <br />
        At this step, you can also choose to Borrow USDS against your SKY (optional). There is a minimum
        borrow amount set as a risk parameter by Sky Ecosystem Governance. Borrowing carries risk of
        liquidation.
      </Trans>
    )
  },
  {
    id: 'choose-reward',
    title: <Trans>2. Choose Reward.</Trans>,
    content: <Trans>Staking Rewards are in the form of USDS.</Trans>
  },
  {
    id: 'delegate',
    title: <Trans>3. Delegate (optional).</Trans>,
    content: (
      <Trans>
        You may choose to transfer the voting power your staked SKY provides to a recognized delegate or a
        contract you own.
      </Trans>
    )
  },
  {
    id: 'open-position',
    title: <Trans>4. Confirm Staking Position:</Trans>,
    content: (
      <Trans>
        Your SKY tokens, as well as any rewards that you accumulate, are supplied to a non-custodial smart
        contract such that no intermediary takes custody of those tokens.
      </Trans>
    )
  }
] as const;

export const StakeHelpModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-containerDark/60 flex w-full flex-col items-center rounded-none p-5 md:w-[780px] md:rounded-2xl md:p-10">
        <DialogHeader className="w-full">
          <HStack>
            <StakeColor width={46} height={46} />
            <DialogTitle className="text-text text-[28px] md:text-[32px]">
              <Trans>How to Stake in 4 steps:</Trans>
            </DialogTitle>
          </HStack>
        </DialogHeader>

        <div className="flex w-full flex-col items-center justify-between md:pl-16">
          <DialogDescription className="text-text text-left">
            {STAKING_STEPS.map((step, index) => (
              <StakingStep key={step.id} title={step.title} content={step.content} isFirst={index === 0} />
            ))}
            <Text className="text-text mt-8 text-[16px]">
              <Trans>With Sky, you always remain in control of your assets.</Trans>
            </Text>
          </DialogDescription>
        </div>

        <DialogClose asChild>
          <Button className="text-text absolute right-4 top-[26px] h-12 w-12 p-0">
            <Close width={24} height={24} />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

const StakingStep = ({
  title,
  content,
  isFirst = false
}: {
  title: React.ReactNode;
  content: React.ReactNode;
  isFirst?: boolean;
}) => (
  <div className={isFirst ? undefined : 'mt-4'}>
    <Text tag="span" className="text-text font-custom-450 text-[18px]">
      {title}
    </Text>
    <Text tag="span" className="text-text ml-1 text-[16px]">
      {content}
    </Text>
  </div>
);
