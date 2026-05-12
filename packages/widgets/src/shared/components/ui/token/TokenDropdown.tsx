import { Trans } from '@lingui/react/macro';
import { motion } from 'motion/react';
import { Token } from '@jetstreamgg/sky-hooks';
import { Popover, PopoverContent } from '@widgets/components/ui/popover';
import { Text } from '@widgets/shared/components/ui/Typography';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { VStack } from '../layout/VStack';
import { TokenSelector } from './TokenSelector';
import { TokenListItem } from './TokenListItem';

type TokenDropdownProps = {
  token: Token;
  tokenList: Token[];
  onTokenSelected: (token: Token) => void;
  enabled?: boolean;
  disabled?: boolean;
  dataTestId?: string;
};

/**
 * Self-contained token picker — TokenSelector trigger + the rich
 * TokenListItem rows used by TokenInput's popover. Use when a flow needs the
 * widget's token-picker UX outside of TokenInput (e.g. the matured-PT redeem
 * modal).
 */
export function TokenDropdown({
  token,
  tokenList,
  onTokenSelected,
  enabled = true,
  disabled,
  dataTestId
}: TokenDropdownProps) {
  return (
    <Popover>
      <TokenSelector
        token={token}
        disabled={disabled || tokenList.length <= 1}
        showChevron={tokenList.length > 1}
        dataTestId={dataTestId}
      />
      <PopoverContent
        className="bg-containerDark border-selectActive/30 w-80 rounded-[20px] border p-2 pt-5 shadow-xl backdrop-blur-[50px]"
        sideOffset={4}
        avoidCollisions
      >
        <VStack className="w-full space-y-2">
          <motion.div variants={positionAnimations}>
            <Text className="text-selectActive ml-5 text-sm leading-none font-medium">
              <Trans>Select token</Trans>
            </Text>
          </motion.div>
          <VStack className="space-y-2">
            {tokenList.map(t => (
              <TokenListItem key={t.symbol} token={t} onTokenSelected={onTokenSelected} enabled={enabled} />
            ))}
          </VStack>
        </VStack>
      </PopoverContent>
    </Popover>
  );
}
