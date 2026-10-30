import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Token } from '@/hooks';
import { TokenSelectorPill } from './TokenSelectorPill';

vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => undefined }));

describe('TokenSelectorPill', () => {
  it('shows the selected symbol', () => {
    const usds = { symbol: 'USDS' } as Token;
    const { getByTestId } = render(<TokenSelectorPill tokens={[usds]} selected={usds} testId="pill" />);
    expect(getByTestId('pill').textContent).toBe('USDS');
  });

  it('renders an empty chip for a non-string symbol instead of throwing', () => {
    // Runtime data can break the `string` type; an object used to throw as a React child.
    const broken = { symbol: {} } as unknown as Token;
    const { getByTestId } = render(<TokenSelectorPill tokens={[broken]} selected={broken} testId="pill" />);
    expect(getByTestId('pill').textContent).toBe('');
  });
});
