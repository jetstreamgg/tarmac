import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { generateUUID } from '@/lib/generateUUID';

interface AnalyticsFlowContextProps {
  readonly startNewFlow: () => void;
  readonly getFlowId: () => string | null;
}

const AnalyticsFlowContext = createContext<AnalyticsFlowContextProps | undefined>(undefined);

export function AnalyticsFlowProvider({ children }: { children: ReactNode }) {
  const flowIdRef = useRef<string | null>(null);

  const startNewFlow = useCallback(() => {
    flowIdRef.current = generateUUID();
  }, []);

  const getFlowId = useCallback(() => flowIdRef.current, []);

  return (
    <AnalyticsFlowContext.Provider value={{ startNewFlow, getFlowId }}>
      {children}
    </AnalyticsFlowContext.Provider>
  );
}

export function useAnalyticsFlow(): AnalyticsFlowContextProps {
  const context = useContext(AnalyticsFlowContext);
  if (!context) {
    throw new Error('useAnalyticsFlow must be used within an AnalyticsFlowProvider');
  }
  return context;
}
