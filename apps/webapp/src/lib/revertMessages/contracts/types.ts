import type { MessageDescriptor } from '@lingui/core';

/**
 * One contract's revert reasons → user-facing copy. Keys are exactly what
 * `decodeRevert` returns: the full `Error(string)` reason including the
 * contract prefix ("LockstakeEngine/urn-unsafe"), or a custom error's name.
 * Values are lazy `msg` descriptors, translated when shown.
 */
export type RevertMessageMap = Readonly<Record<string, MessageDescriptor>>;
