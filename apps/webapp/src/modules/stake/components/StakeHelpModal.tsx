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
import { PopoverInfo } from '@/modules/ui/components/PopoverInfo';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

const circledNumber = (number: number) => {
  return (
    <Text
      className={
        'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white text-center text-xs text-white'
      }
    >
      {number}
    </Text>
  );
};

const STAKING_STEPS = (bpi: number) =>
  [
    {
      id: 'stake',
      number: 1,
      title: <Trans>Supply SKY</Trans>,
      content: (
        <Trans>
          Supply SKY to the Staking Engine to create one or more positions through which you access Staking
          Rewards{' '}
          <PopoverInfo type="stakingRewards" width={bpi === 0 ? 13 : 16} height={bpi === 0 ? 13 : 15} /> and
          more.
          <br />
          <br />
          At this step, you can also choose to Borrow{' '}
          <PopoverInfo type="borrow" width={bpi === 0 ? 13 : 16} height={bpi === 0 ? 13 : 15} /> USDS against
          your SKY (optional). There is a minimum borrow amount set as a risk parameter by Sky Ecosystem
          Governance. Borrowing carries risk of liquidation{' '}
          <PopoverInfo type="liquidation" width={bpi === 0 ? 13 : 16} height={bpi === 0 ? 13 : 15} />.
        </Trans>
      )
    },
    {
      id: 'choose-reward',
      number: 2,
      title: <Trans>Choose Reward</Trans>,
      content: <Trans>Choose from the Staking Reward options.</Trans>
    },
    {
      id: 'delegate',
      number: 3,
      title: <Trans>Delegate (optional)</Trans>,
      content: (
        <Trans>
          You may choose to transfer the voting power your staked SKY provides to a recognized delegate{' '}
          <PopoverInfo type="delegate" width={bpi === 0 ? 13 : 16} height={bpi === 0 ? 13 : 15} /> or a
          contract you own.
        </Trans>
      )
    },
    {
      id: 'open-position',
      number: 4,
      title: <Trans>Confirm Staking Position</Trans>,
      content: (
        <Trans>
          Your SKY tokens, as well as any rewards that you accumulate, are supplied to a non-custodial smart
          contract such that no intermediary takes custody of those tokens.
        </Trans>
      )
    }
  ] as const;

export const StakeHelpModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { bpi } = useBreakpointIndex();
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-containerDark/60 flex w-full flex-col items-center rounded-none p-5 md:w-[780px] md:rounded-2xl md:p-10">
        <DialogHeader className="w-full">
          <HStack>
            <StakeColor width={bpi === 0 ? 32 : 46} height={bpi === 0 ? 32 : 46} />
            <DialogTitle className="text-text text-[20px] sm:text-[28px] md:text-[32px]">
              <Trans>How to Stake in 4 steps:</Trans>
            </DialogTitle>
          </HStack>
        </DialogHeader>

        <div className="flex w-full flex-col items-center justify-between md:pl-16">
          <DialogDescription className="text-text text-left">
            {STAKING_STEPS(bpi).map((step, index) => (
              <StakingStep
                key={step.id}
                title={step.title}
                content={step.content}
                isFirst={index === 0}
                number={step.number}
              />
            ))}
            <Text className="text-text mt-8 text-[14px] sm:text-[16px]">
              <Trans>With Sky, you always remain in control of your assets.</Trans>
            </Text>
          </DialogDescription>
        </div>

        <DialogClose asChild>
          <Button className="text-text absolute right-4 top-[26px] h-12 w-12 p-0">
            <Close width={bpi === 0 ? 20 : 24} height={bpi === 0 ? 20 : 24} />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

const StakingStep = ({
  title,
  content,
  number,
  isFirst = false
}: {
  title: React.ReactNode;
  content: React.ReactNode;
  number: number;
  isFirst?: boolean;
}) => (
  <div className={isFirst ? undefined : 'mt-4'}>
    <div className="flex items-center">
      {circledNumber(number)}
      <Text className="text-text ml-2 text-[16px] font-bold sm:text-[18px]">{title}</Text>
    </div>
    <Text className="mt-1 text-[12px] text-white/80 sm:text-[14px]">{content}</Text>
  </div>
);
