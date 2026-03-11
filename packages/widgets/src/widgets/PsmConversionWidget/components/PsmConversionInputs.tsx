import { Token, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { motion } from 'framer-motion';
import { Button } from '@widgets/components/ui/button';
import { ShiftArrow } from '@widgets/shared/components/icons/Icons';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { useChainId } from 'wagmi';

export function PsmConversionInputs({
  originToken,
  targetToken,
  originAmount,
  targetAmount,
  originBalance,
  targetBalance,
  isBalanceError,
  isConnectedAndEnabled,
  onOriginAmountChange,
  onSwitchDirection
}: {
  originToken: Token;
  targetToken: Token;
  originAmount: bigint;
  targetAmount: bigint;
  originBalance?: bigint;
  targetBalance?: bigint;
  isBalanceError: boolean;
  isConnectedAndEnabled: boolean;
  onOriginAmountChange: (value: bigint) => void;
  onSwitchDirection: () => void;
}) {
  const chainId = useChainId();

  return (
    <VStack className="items-stretch" gap={0}>
      <motion.div variants={positionAnimations}>
        <TokenInput
          key={originToken.symbol}
          className="w-full"
          label={t`Enter the amount to convert`}
          token={originToken}
          tokenList={[originToken]}
          balance={originBalance}
          onChange={value => onOriginAmountChange(value)}
          value={originAmount}
          dataTestId="psm-conversion-origin"
          error={isBalanceError ? t`Insufficient funds` : undefined}
          variant="top"
          extraPadding
          showPercentageButtons={isConnectedAndEnabled}
          enabled={isConnectedAndEnabled}
          enableSearch={false}
          maxVisibleTokenRows={1}
        />
      </motion.div>

      <motion.div variants={positionAnimations} className="-my-3 z-10 flex justify-center">
        <Button
          aria-label="Switch conversion direction"
          size="icon"
          className="border-background text-tabPrimary focus:outline-hidden h-9 w-9 rounded-full bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent"
          onClick={onSwitchDirection}
        >
          <ShiftArrow height={24} className="text-textDesaturated" />
        </Button>
      </motion.div>

      <motion.div variants={positionAnimations}>
        <TokenInput
          key={targetToken.symbol}
          className="w-full"
          label={t`You will receive`}
          token={targetToken}
          tokenList={[targetToken]}
          balance={targetBalance}
          onChange={() => null}
          value={targetAmount}
          dataTestId="psm-conversion-target"
          variant="bottom"
          showPercentageButtons={false}
          enabled={isConnectedAndEnabled}
          inputDisabled
          enableSearch={false}
          maxVisibleTokenRows={1}
          limitText={
            targetAmount > 0n
              ? `${formatUnits(targetAmount, getTokenDecimals(targetToken, chainId))} ${targetToken.symbol}`
              : undefined
          }
        />
      </motion.div>
    </VStack>
  );
}
