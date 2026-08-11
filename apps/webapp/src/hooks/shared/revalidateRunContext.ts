import { createContext } from 'react';

/**
 * Epoch bumped by the transaction modal whenever the user regains an editable
 * surface while a sequential run may be lingering: backing out of the
 * wallet/status screen to the entry, closing the modal (page-hosted engines
 * survive a close), or a session-replacing launch. Engines stamp the epoch at
 * dispatch; a mismatch tells them their frozen snapshot is no longer above
 * suspicion, and they drop the run once the live calls diverge from it (see
 * useSequentialTransactionFlow). Runs the live calls still match keep their
 * resume, which is what makes bumping safe for every engine in the tree. The
 * default means "never bumped" for engines mounted outside the provider.
 */
export const RevalidateRunContext = createContext(0);
