import type { MessageDescriptor } from '@lingui/core';
import { toFunctionSelector } from 'viem';

/** A custom error by name (decoded against an ABI) and by selector (decoded without one). */
export const customError = (signature: string): string[] => [
  signature.slice(0, signature.indexOf('(')),
  toFunctionSelector(signature)
];

/** The same copy under both keys of `customError`. */
export const customErrorMessage = (
  signature: string,
  message: MessageDescriptor
): Record<string, MessageDescriptor> => Object.fromEntries(customError(signature).map(key => [key, message]));
