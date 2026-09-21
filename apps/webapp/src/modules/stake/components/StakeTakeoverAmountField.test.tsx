import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

i18n.load('en', {});
i18n.activate('en');
const WAD = 10n ** 18n;

function Harness({ initial = 0n }: { initial?: bigint }) {
  return (
    <I18nProvider i18n={i18n}>
      <Controlled initial={initial} />
    </I18nProvider>
  );
}

import { useState } from 'react';
function Controlled({ initial }: { initial: bigint }) {
  const [amount, setAmount] = useState(initial);
  return (
    <StakeTakeoverAmountField
      tokenSymbol="SKY"
      amount={amount}
      onAmountChange={setAmount}
      onPercentClick={percent => setAmount((1000n * WAD * BigInt(percent)) / 100n)}
      dataTestId="field"
    />
  );
}

describe('StakeTakeoverAmountField', () => {
  it('pops a typed digit and rolls a chip-driven change (Design QA 3450:121929)', () => {
    render(<Harness />);
    const input = screen.getByTestId('field');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.change(input, { target: { value: '51' } });
    const popped = screen.getAllByTestId('rolling-digit-in');
    expect(popped).toHaveLength(1);
    expect(popped[0].textContent).toBe('1');
    expect(popped[0].getAttribute('data-transition')).toBe('pop');
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);

    fireEvent.change(input, { target: { value: '5' } });
    const gone = screen.getAllByTestId('rolling-digit-out');
    expect(gone.map(el => el.textContent)).toEqual(['1']);
    expect(gone[0].getAttribute('data-transition')).toBe('pop');
    fireEvent.animationEnd(gone[0]);

    fireEvent.click(screen.getByTestId('field-percent-50'));
    expect(screen.getByTestId('field-display').textContent).toBe('500');
    const rolled = screen.getAllByTestId('rolling-digit-in');
    expect(rolled.every(el => el.getAttribute('data-transition') === 'roll')).toBe(true);
  });
});
