import { useState } from 'react';
import type { BridgeNetworkId } from '../model/networks';

/** What the user typed and picked in the Bridge form; held above the tab, it survives a tab switch. */
export function useBridgeDraft() {
  const [sourceOverride, setSourceOverride] = useState<BridgeNetworkId | null>(null);
  const [pickedTo, setPickedTo] = useState<BridgeNetworkId>('base');
  const [value, setValue] = useState('');
  const [recipient, setRecipient] = useState<string | undefined>(undefined);
  return {
    sourceOverride,
    setSourceOverride,
    pickedTo,
    setPickedTo,
    value,
    setValue,
    recipient,
    setRecipient
  };
}

export type BridgeDraft = ReturnType<typeof useBridgeDraft>;
