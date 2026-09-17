import { createContext, useContext } from 'react';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import type { TransactionConfig } from './transactionContract';

/** The live config of a `launch(config)` session, merged by `updateModalContent`. */
export const ConfigFlowContext = createContext<TransactionConfig | null>(null);

/**
 * The flow a `launch(config)` renders: the static config shape drawn through
 * the same `TransactionModal` a flow component renders. Its `backgroundContent`
 * host lives beside the modal, hidden, exactly where the provider used to keep
 * it. Goes away with the last config launch.
 */
export function ConfigFlow() {
  const config = useContext(ConfigFlowContext);
  if (!config) return null;
  return (
    <>
      {config.backgroundContent && <div hidden>{config.backgroundContent}</div>}
      <TransactionModal
        title={config.title}
        transactionTitle={config.transactionTitle}
        reviewTitle={config.reviewTitle}
        subtitles={config.subtitles}
        transactionContent={config.transactionContent}
        transactionScreenContent={config.transactionScreenContent}
        entry={config.entry}
        rightHeaderComponent={config.rightHeaderComponent}
        titleBadge={config.titleBadge}
        onConfirm={config.onConfirm}
        onSecondaryConfirm={config.onSecondaryConfirm}
        onRetry={config.onRetry}
        onSuccess={config.onSuccess}
        onError={config.onError}
        confirmLabel={config.confirmLabel}
        confirmDisabled={config.confirmDisabled}
        errorMessage={config.errorMessage}
        successLabel={config.successLabel}
        errorLabel={config.errorLabel}
        steps={config.steps}
        analytics={config.analytics}
        usdValue={config.usdValue}
        toast={config.toast}
      />
    </>
  );
}
