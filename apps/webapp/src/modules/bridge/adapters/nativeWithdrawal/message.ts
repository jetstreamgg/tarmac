import { getAddress, isAddressEqual, type Address, type Log } from 'viem';
import type { PendingBridge } from '../../model/types';
import { isOpStackNetwork, type NativeDepositNetwork } from '../nativeDeposit/contracts';
import { arbitrumWithdrawalMessage } from './arbitrum';
import { opStackWithdrawalMessage } from './opStack';

/** The USDS withdrawal a receipt's logs carry, read the way `network`'s bridge emits it. */
export const nativeWithdrawalMessage = (logs: Log[], network: NativeDepositNetwork) =>
  isOpStackNetwork(network) ? opStackWithdrawalMessage(logs, network) : arbitrumWithdrawalMessage(logs);

/** Whether a withdrawal pays this bridge: its amount, to its recipient (its account when it names none). */
export const matchesBridge = <withdrawal extends { amount: bigint; to: Address }>(
  message: withdrawal | undefined,
  bridge: Pick<PendingBridge, 'amount' | 'recipient' | 'account'>
): message is withdrawal =>
  !!message &&
  message.amount === bridge.amount &&
  isAddressEqual(message.to, getAddress(bridge.recipient ?? bridge.account));
