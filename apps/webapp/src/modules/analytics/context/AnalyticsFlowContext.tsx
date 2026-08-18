import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { generateUUID } from '@/lib/generateUUID';

interface AnalyticsFlowContextProps {
  readonly startNewFlow: () => void;
  readonly getFlowId: () => string;
}

const AnalyticsFlowContext = createContext<AnalyticsFlowContextProps | undefined>(undefined);

export function AnalyticsFlowProvider({ children }: { children: ReactNode }) {
  // Seeded at mount (lazy ref init) so the session's FIRST funnel already has a
  // joinable flow_id instead of null; startNewFlow rotates it from there.
  const flowIdRef = useRef<string | null>(null);
  if (flowIdRef.current === null) {
    flowIdRef.current = generateUUID();
  }

  const startNewFlow = useCallback(() => {
    flowIdRef.current = generateUUID();
  }, []);

  const getFlowId = useCallback((): string => {
    if (flowIdRef.current === null) {
      flowIdRef.current = generateUUID();
    }
    return flowIdRef.current;
  }, []);

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
