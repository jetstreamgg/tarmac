import type { MessageDescriptor } from '@lingui/core';
import { toFunctionSelector } from 'viem';

/** A custom error by name (decoded against an ABI) and by selector (decoded without one). */
export const customError = (signature: string): string[] => {
  const paren = signature.indexOf('(');
  if (paren <= 0) throw new Error(`customError needs a full signature like "Name()", got "${signature}"`);
  return [signature.slice(0, paren), toFunctionSelector(signature)];
};

/** The same copy under both keys of `customError`. */
export const customErrorMessage = (
  signature: string,
  message: MessageDescriptor
): Record<string, MessageDescriptor> => Object.fromEntries(customError(signature).map(key => [key, message]));
