import { PopoverTrigger } from '@widgets/components/ui/popover';
import { Text } from '@widgets/shared/components/ui/Typography';
import { HStack } from '../layout/HStack';
import { TokenIcon } from './TokenIcon';
import { ChevronDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { Token } from '@jetstreamgg/sky-hooks';

interface TokenSelectorProps {
  token?: Token;
  label?: string;
  disabled?: boolean;
  showChevron?: boolean;
  dataTestId?: string;
  extraBottomPadding?: boolean;
}

export function TokenSelector({
  token,
  label,
  disabled,
  dataTestId,
  showChevron = true,
  extraBottomPadding = false
}: TokenSelectorProps): React.ReactElement {
  return (
    <PopoverTrigger
      disabled={disabled}
      className={`w-full ${token ? 'max-w-[104px]' : ''}`}
      data-testid={`${dataTestId}-menu-button`}
    >
      {token ? (
        <HStack className={`text-text ${disabled ? '' : 'cursor-pointer'} items-center justify-end`} gap={1}>
          <TokenIcon className="mr-2 h-6 w-6 text-black" fallbackClassName="text-[9px]" token={token} />
          <Text>{token.symbol}</Text>
          {showChevron && (
            <ChevronDown className="chevron-down text-textDesaturated h-6 w-6 shrink-0 transition-transform duration-200" />
          )}
        </HStack>
      ) : (
        <div className={`${extraBottomPadding ? 'pb-[47px]' : ''}`}>
          {label && (
            <Text className="text-text mb-4 text-left text-sm font-normal leading-none">{label}</Text>
          )}
          <HStack className="text-surface cursor-pointer items-center justify-between px-0 pb-0 pt-4">
            <Text className="text-textDimmed text-[18px]">
              <Trans>Select token</Trans>
            </Text>
            <ChevronDown className="chevron-down text-textDesaturated h-6 w-6 shrink-0 transition-transform duration-200" />
          </HStack>
        </div>
      )}
    </PopoverTrigger>
  );
}
